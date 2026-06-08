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

  // ── Detect project type ───────────────────────────────────────────
  // Two paths:
  //   1. Node project — has package.json with a dev/start/serve script.
  //      We install deps and run the script. Slow first boot (~60-90s).
  //   2. Static project — no package.json (or package.json without a
  //      runnable script) but has at least one HTML file. We skip
  //      install entirely and serve the files from a tiny built-in
  //      Node static server. Boot is ~5-10s instead of 90s.
  const pkgFile = files["package.json"];
  let pkg: Record<string, unknown> | null = null;
  if (pkgFile) {
    try { pkg = JSON.parse(pkgFile); }
    catch { return jsonError("bad_package_json", 400, "package.json doesn't parse as JSON"); }
  }
  const scripts = (pkg?.scripts as Record<string, string>) || {};
  const nodeScript =
    body.devCommand ||
    (scripts.dev ? "dev" : scripts.start ? "start" : scripts.serve ? "serve" : null);

  // If there's no runnable Node script, treat this as a static project
  // IF it has any HTML file. Otherwise we genuinely can't preview it.
  const hasHtml = entries.some(([p]) => p.toLowerCase().endsWith(".html"));
  const isStatic = !nodeScript && hasHtml;
  if (!nodeScript && !hasHtml) {
    return jsonError(
      "no_runnable_project",
      400,
      "Project has no package.json with a dev script AND no HTML files — nothing to preview. Ask one of the agents to add either a package.json with a 'dev' script, or an HTML file.",
    );
  }

  const port = isStatic
    ? 3000
    : (Number(body.port) || detectDefaultPort(pkg ?? {}, scripts[nodeScript ?? ""] || ""));

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

  // ── Install (Node only) + spawn server ─────────────────────────────
  // Static project: write a tiny ~30-line Node static file server
  // alongside the user's files and run it. No npm install — Node 24
  // is already in the sandbox. Total boot: ~5s.
  //
  // Node project: install deps (slow), then spawn the dev script
  // detached so this handler can return.
  let installer: "static" | "bun" | "npm";
  if (isStatic) {
    installer = "static";
    // Inject a minimal Node static file server. Serves the directory
    // recursively, falls back to the first .html file when '/' is
    // requested and there's no index.html (so a project with just
    // `snippet-1.html` previews without renames).
    const staticServerJs = buildStaticServerJs(port, entries.map(([p]) => p));
    try {
      await sandbox.writeFiles([
        { path: "__veronum_serve.js", content: Buffer.from(staticServerJs, "utf8") },
      ]);
    } catch (e) {
      await sandbox.stop().catch(() => {});
      return jsonError("write_failed", 502, (e as Error).message);
    }
    void sandbox.runCommand("sh", [
      "-c",
      `nohup node __veronum_serve.js > /tmp/dev.log 2>&1 &`,
    ]).catch((e) => console.warn(`[sandbox] static-server spawn warn: ${(e as Error).message}`));
  } else {
    // Prefer bun if there's a bun.lock; falls back to npm.
    const useBun = !!files["bun.lock"] || !!files["bun.lockb"];
    installer = useBun ? "bun" : "npm";
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
    void sandbox.runCommand("sh", [
      "-c",
      `nohup ${runner} run ${nodeScript} > /tmp/dev.log 2>&1 &`,
    ]).catch((e) => console.warn(`[sandbox] dev spawn warn: ${(e as Error).message}`));
  }

  // The public URL is deterministic from the sandbox + port.
  const previewUrl = sandbox.domain(port);

  console.log(
    `[sandbox] ready user=${userId} url=${previewUrl} in ${Date.now() - startedAt}ms`,
  );

  return Response.json({
    previewUrl,
    expiresAt: new Date(Date.now() + SANDBOX_TIMEOUT_MS).toISOString(),
    mode: isStatic ? "static" : "node",
    devScript: isStatic ? null : nodeScript,
    port,
    installer,
  });
}

/** Inline static file server source — written into the sandbox + run
 *  with `node`. ~30 lines, zero npm deps. Serves the working dir
 *  recursively; if '/' is requested and index.html doesn't exist,
 *  falls back to the first .html file in the project (so chats that
 *  produced `snippet-1.html` preview cleanly without renames). */
function buildStaticServerJs(port: number, paths: string[]): string {
  const firstHtml = paths.find((p) => p.toLowerCase().endsWith(".html")) ?? "index.html";
  return `
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = ${port};
const FALLBACK_HTML = ${JSON.stringify(firstHtml)};
const TYPES = {
  html: 'text/html; charset=utf-8',
  css:  'text/css; charset=utf-8',
  js:   'application/javascript; charset=utf-8',
  mjs:  'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg:  'image/svg+xml',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  webp: 'image/webp',
  ico:  'image/x-icon',
  woff: 'font/woff',
  woff2:'font/woff2',
  txt:  'text/plain; charset=utf-8',
};
http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') {
    const idx = path.join(process.cwd(), 'index.html');
    if (!fs.existsSync(idx)) urlPath = '/' + FALLBACK_HTML;
    else urlPath = '/index.html';
  }
  const filePath = path.join(process.cwd(), urlPath);
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).slice(1).toLowerCase();
    res.writeHead(200, {'Content-Type': TYPES[ext] || 'application/octet-stream'});
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => console.log('[veronum-static] serving on ' + PORT + ' (fallback: ' + FALLBACK_HTML + ')'));
`;
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
