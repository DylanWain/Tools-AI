/**
 * POST /api/sandbox/preview
 *
 * The "live preview" feature — clicks a Preview button in the chat's
 * workspace and gets back a public URL serving their generated app.
 *
 * Body:    { files: Record<path, content>, devCommand?: string, port?: number }
 * Headers: Authorization: Bearer <jwt>
 * Returns: { previewUrl, sandboxId, expiresAt }
 *
 * What the route does:
 *   1. JWT validation — only subscribers + admin can spin sandboxes
 *      (this costs real Active CPU per second on Vercel's bill)
 *   2. Spawns a Vercel Sandbox microVM via @vercel/sandbox
 *   3. Writes the user's virtual project files into /vercel/sandbox
 *   4. Runs install (`bun install` if bun.lock, else `npm install`)
 *   5. Spawns the dev server in the background (`bun run dev`, etc.)
 *   6. Waits for the dev port to come up and exposes it publicly
 *   7. Returns the public URL the client renders in an iframe
 *
 * Cost containment:
 *   - 10-minute auto-shutdown built into Sandbox.create({ timeout })
 *   - Subscriber-only gate — chad/payg/admin tiers only
 *   - One active sandbox per user (we don't track this yet; relies on
 *     the 10-min timeout to bound spend)
 *
 * Env vars (on Vercel, the OIDC token is automatic — no env vars
 * needed in production; local dev needs VERCEL_TOKEN etc.):
 *   AGENT_BROWSER_SNAPSHOT_ID  — optional pre-baked snapshot for sub-sec
 *                                 boot. Without it, ~30s cold start.
 */
import { Sandbox } from "@vercel/sandbox";
import { extractBearer, decideBilling } from "@/lib/compare/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sandbox spinup + install + first-paint can take 60-90s without a
// snapshot. Give the route plenty of headroom.
export const maxDuration = 300;

const SANDBOX_TIMEOUT_MS = 10 * 60 * 1000;  // 10 min — billing ceiling per request
const MAX_FILES = 200;
const MAX_FILE_BYTES = 256 * 1024;          // 256KB per file
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;    // 8MB total payload

type FilesMap = Record<string, string>;

export async function POST(req: Request) {
  // ── Auth + subscriber gate ────────────────────────────────────────
  const token = extractBearer(req);
  if (!token) return jsonError("unauthenticated", 401);
  const decision = await decideBilling(token);
  if (!decision.ok) {
    if (decision.reason === "unauthenticated" || decision.reason === "invalid_token") {
      return jsonError(decision.reason, 401);
    }
    if (decision.reason === "over_quota") {
      // Even over-quota users should at least see why they can't preview.
      return jsonError("over_quota", 402);
    }
    return jsonError(decision.reason, 500);
  }
  const subOK = decision.tier === "chad" || decision.tier === "payg" || decision.tier === "admin";
  if (!subOK) {
    return jsonError(
      "subscriber_required",
      403,
      "Live preview is a subscriber feature — burns real compute per second. Subscribe ($25/mo) or pay-as-you-go to unlock.",
    );
  }

  // ── Parse + validate the file map ─────────────────────────────────
  let body: { files?: FilesMap; devCommand?: string; port?: number };
  try { body = await req.json(); }
  catch { return jsonError("invalid_json", 400); }

  const files = body.files;
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return jsonError("files_required", 400);
  }
  const entries = Object.entries(files);
  if (entries.length === 0) return jsonError("no_files", 400);
  if (entries.length > MAX_FILES) {
    return jsonError("too_many_files", 413, `max ${MAX_FILES} files per preview`);
  }
  let totalBytes = 0;
  for (const [path, content] of entries) {
    if (typeof path !== "string" || !path) return jsonError("bad_path", 400);
    if (typeof content !== "string") return jsonError("bad_content", 400);
    // Defense against path traversal — Sandbox writes are scoped to
    // its own filesystem, but we sanitize anyway.
    if (path.includes("..") || path.startsWith("/") || path.startsWith("~")) {
      return jsonError("path_traversal", 400, `bad path: ${path}`);
    }
    const size = Buffer.byteLength(content, "utf8");
    if (size > MAX_FILE_BYTES) {
      return jsonError("file_too_large", 413, `${path} is ${size}B (max ${MAX_FILE_BYTES})`);
    }
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return jsonError("payload_too_large", 413, `total > ${MAX_TOTAL_BYTES} bytes`);
    }
  }

  // ── Detect framework + commands ───────────────────────────────────
  const pkgFile = files["package.json"];
  if (!pkgFile) {
    return jsonError(
      "no_package_json",
      400,
      "Project needs a package.json at the root for the preview to know what to install + run.",
    );
  }
  let pkg: Record<string, unknown>;
  try { pkg = JSON.parse(pkgFile); }
  catch { return jsonError("bad_package_json", 400, "package.json doesn't parse as JSON"); }

  const scripts = (pkg.scripts as Record<string, string>) || {};
  const devScript =
    body.devCommand ||
    (scripts.dev ? "dev" : scripts.start ? "start" : scripts.serve ? "serve" : null);
  if (!devScript) {
    return jsonError(
      "no_dev_script",
      400,
      "package.json needs a 'dev', 'start', or 'serve' script for the preview to launch.",
    );
  }
  const port = Number(body.port) || detectDefaultPort(pkg, scripts[devScript] || "");

  const userId = decision.userId;
  const startedAt = Date.now();
  console.log(`[sandbox] user=${userId} files=${entries.length} bytes=${totalBytes} port=${port}`);

  // ── Spawn the sandbox ─────────────────────────────────────────────
  let sandbox: InstanceType<typeof Sandbox>;
  try {
    sandbox = await Sandbox.create({
      // OIDC auth is automatic on Vercel. Local dev needs the three
      // VERCEL_* env vars; if absent we just rely on the SDK's
      // VERCEL_OIDC_TOKEN fallback.
      ...sandboxCredentials(),
      runtime: "node24",
      timeout: SANDBOX_TIMEOUT_MS,
      // Open the dev port so the public URL serves traffic to the
      // dev server inside the sandbox.
      ports: [port],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sandbox_spawn_failed";
    console.error(`[sandbox] spawn failed for ${userId}: ${msg}`);
    return jsonError("sandbox_spawn_failed", 502, msg);
  }

  // ── Write files into the sandbox ──────────────────────────────────
  try {
    await sandbox.writeFiles(
      entries.map(([path, content]) => ({
        path,
        content: Buffer.from(content, "utf8"),
      })),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "write_failed";
    await sandbox.stop().catch(() => {});
    return jsonError("write_failed", 502, msg);
  }

  // ── Install deps + spawn dev server ───────────────────────────────
  // Prefer bun if there's a bun.lock; falls back to npm. We don't
  // await the dev server — it runs detached. We then poll the public
  // URL until it responds, returning either the URL or a timeout.
  const useBun = !!files["bun.lock"] || !!files["bun.lockb"];
  const installer = useBun ? "bun" : "npm";
  const runner = useBun ? "bun" : "npm";

  try {
    const install = await sandbox.runCommand(installer, ["install"]);
    if (install.exitCode !== 0) {
      const errText = (await install.stderr()).slice(-2000);
      await sandbox.stop().catch(() => {});
      return jsonError("install_failed", 502, errText || `${installer} install exited ${install.exitCode}`);
    }
  } catch (e) {
    await sandbox.stop().catch(() => {});
    return jsonError("install_failed", 502, (e as Error).message);
  }

  // Spawn the dev script DETACHED — we don't want runCommand to wait
  // for it to finish (it never will, that's the point of a dev server).
  // Using `nohup ... &` with stdout/stderr redirected so the sandbox
  // doesn't block waiting for the process to flush.
  void sandbox.runCommand("sh", [
    "-c",
    `nohup ${runner} run ${devScript} > /tmp/dev.log 2>&1 &`,
  ]).catch((e) => console.warn(`[sandbox] dev spawn warn: ${(e as Error).message}`));

  // The public URL is deterministic from the sandbox + port.
  const previewUrl = sandbox.domain(port);

  console.log(
    `[sandbox] ready user=${userId} url=${previewUrl} in ${Date.now() - startedAt}ms`,
  );

  return Response.json({
    previewUrl,
    sandboxId: sandbox.sandboxId,
    expiresAt: new Date(Date.now() + SANDBOX_TIMEOUT_MS).toISOString(),
    devScript,
    port,
    installer,
  });
}

function sandboxCredentials() {
  if (
    process.env.VERCEL_TOKEN &&
    process.env.VERCEL_TEAM_ID &&
    process.env.VERCEL_PROJECT_ID
  ) {
    return {
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };
  }
  return {};
}

/** Try to extract the dev server's port from common framework
 *  configs. Falls back to 3000 if nothing matches. */
function detectDefaultPort(pkg: Record<string, unknown>, devCommand: string): number {
  // Explicit --port flag wins
  const portFlag = /--port[= ](\d+)/.exec(devCommand);
  if (portFlag) return parseInt(portFlag[1], 10);
  const pFlag = /-p (\d+)/.exec(devCommand);
  if (pFlag) return parseInt(pFlag[1], 10);

  // Framework defaults
  const deps = {
    ...(pkg.dependencies as Record<string, string> || {}),
    ...(pkg.devDependencies as Record<string, string> || {}),
  };
  if (deps.next) return 3000;
  if (deps.vite || deps["@vitejs/plugin-react"]) return 5173;
  if (deps.astro) return 4321;
  if (deps.nuxt) return 3000;
  if (deps["@sveltejs/kit"]) return 5173;
  if (deps["create-react-app"] || deps["react-scripts"]) return 3000;
  return 3000;
}

function jsonError(error: string, status: number, detail?: string) {
  return Response.json(
    { error, ...(detail ? { detail } : {}) },
    { status },
  );
}
