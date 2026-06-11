/**
 * POST /api/github/ingest
 *
 * Ingests a public GitHub repository so Veronum's models can see the
 * user's actual code. Two-step fetch:
 *   1. Trees API gives the full file listing for a ref (default branch)
 *   2. raw.githubusercontent.com fetches the actual bytes — doesn't
 *      count against the 60/hour unauthenticated API rate limit
 *
 * Filters applied to keep payloads sane:
 *   - vendor / build directories dropped (node_modules, .next, dist, ...)
 *   - binary-ish extensions dropped (images, fonts, archives)
 *   - per-file cap 100 KB; total cap 1.5 MB; file count cap 250
 *   - first matching trade-off: alphabetical order, take until the
 *     cap is hit. The renderer can re-ingest a deeper subtree later.
 *
 * Body:    { url: string, ref?: string }
 *          url accepts:  github.com/owner/repo, owner/repo, full URL
 *          ref optional — defaults to the repo's default branch
 * Returns: { files: { path, content }[], totalBytes, droppedCount, repo, ref }
 *
 * Auth comes later (PR2). Public repos only for now.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 100 * 1024;
const MAX_TOTAL_BYTES = 1_500 * 1024;
const MAX_FILE_COUNT = 250;

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".turbo", "dist", "build", "out",
  ".git", "vendor", "target", ".cache", ".vscode", ".idea",
  "coverage", "__pycache__", ".pytest_cache", ".venv",
]);

const ALLOWED_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "go", "rs", "rb", "java", "kt", "swift",
  "c", "cc", "cpp", "h", "hpp",
  "html", "css", "scss", "sass", "vue", "svelte",
  "md", "mdx", "txt", "yaml", "yml", "toml", "json",
  "sh", "bash", "zsh", "fish", "sql", "graphql", "proto",
  "env", "gitignore", "dockerignore",
  "lock",
]);

type FilePayload = { path: string; content: string };

function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const cleaned = input.trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .split(/[?#]/)[0];
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  if (!/^[\w.-]{1,100}$/.test(owner) || !/^[\w.-]{1,100}$/.test(repo)) return null;
  return { owner, repo };
}

function shouldSkipPath(path: string): boolean {
  for (const segment of path.split("/")) {
    if (SKIP_DIRS.has(segment)) return true;
  }
  return false;
}

function extensionOf(path: string): string {
  const base = path.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    // Files without an extension we still allow if their full name
    // matches a known config (Dockerfile, Makefile, etc.).
    const lower = base.toLowerCase();
    if (["dockerfile", "makefile", "readme", "license", "procfile"].includes(lower)) {
      return lower;
    }
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

function isAllowedFile(path: string): boolean {
  const ext = extensionOf(path);
  if (!ext) return false;
  if (["dockerfile", "makefile", "readme", "license", "procfile"].includes(ext)) {
    return true;
  }
  return ALLOWED_EXTENSIONS.has(ext);
}

async function resolveDefaultBranch(owner: string, repo: string): Promise<string | null> {
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { accept: "application/vnd.github+json" },
  });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { default_branch?: string } | null;
  return j?.default_branch ?? null;
}

async function listFiles(
  owner: string,
  repo: string,
  ref: string,
): Promise<{ path: string; size: number }[] | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const r = await fetch(url, { headers: { accept: "application/vnd.github+json" } });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as
    | { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean }
    | null;
  if (!j?.tree) return null;
  return j.tree
    .filter((entry) => entry.type === "blob" && entry.path)
    .map((entry) => ({ path: entry.path, size: entry.size ?? 0 }));
}

async function fetchRawText(
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return await r.text();
}

export async function POST(req: Request) {
  let body: { url?: string; ref?: string };
  try { body = await req.json(); } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
  const url = typeof body.url === "string" ? body.url : "";
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    return Response.json({
      error: "invalid_url",
      detail: "Expected owner/repo, github.com/owner/repo, or a full GitHub URL.",
    }, { status: 400 });
  }
  const { owner, repo } = parsed;

  const requestedRef = typeof body.ref === "string" && body.ref.trim()
    ? body.ref.trim() : null;
  // Branch resolution order:
  //   1. Caller-supplied `ref` wins outright.
  //   2. Repo's actual `default_branch` (one extra API call).
  //   3. Fallback: try "main", then "master" — covers ~all repos
  //      including older ones where the rename never happened.
  // Without this fallback any repo whose default_branch lookup is rate
  // limited by GitHub's 60/hr unauthenticated cap silently 404s on the
  // trees API.
  const resolvedDefault = requestedRef ? null : await resolveDefaultBranch(owner, repo);
  const refsToTry: string[] = [];
  if (requestedRef) refsToTry.push(requestedRef);
  else if (resolvedDefault) refsToTry.push(resolvedDefault);
  else refsToTry.push("main", "master");

  let tree: { path: string; size: number }[] | null = null;
  let ref = refsToTry[0];
  for (const candidate of refsToTry) {
    const result = await listFiles(owner, repo, candidate);
    if (result) {
      tree = result;
      ref = candidate;
      break;
    }
  }

  if (!tree) {
    return Response.json({
      error: "fetch_failed",
      detail:
        `Could not list files for ${owner}/${repo}. ` +
        `Tried branch(es): ${refsToTry.join(", ")}. ` +
        `Check the URL is a public repo, and that the branch exists. ` +
        `GitHub's API may be rate-limiting us (60 requests/hour unauthenticated) — try again in a few minutes.`,
    }, { status: 502 });
  }

  // Filter, then sort alphabetically so the take-until-cap behaviour
  // is deterministic across runs of the same repo.
  const candidates = tree
    .filter((f) => !shouldSkipPath(f.path) && isAllowedFile(f.path) && f.size <= MAX_FILE_BYTES)
    .sort((a, b) => a.path.localeCompare(b.path));

  const files: FilePayload[] = [];
  let totalBytes = 0;
  let droppedCount = 0;
  for (const entry of candidates) {
    if (files.length >= MAX_FILE_COUNT) { droppedCount++; continue; }
    if (totalBytes + entry.size > MAX_TOTAL_BYTES) { droppedCount++; continue; }
    const content = await fetchRawText(owner, repo, ref, entry.path);
    if (content === null) { droppedCount++; continue; }
    if (content.length > MAX_FILE_BYTES) { droppedCount++; continue; }
    files.push({ path: entry.path, content });
    totalBytes += content.length;
  }

  console.log(
    `[/api/github/ingest] ${owner}/${repo}@${ref} → ${files.length} files, ${totalBytes}B, ${droppedCount} dropped of ${tree.length}`,
  );
  return Response.json({
    repo: `${owner}/${repo}`,
    ref,
    files,
    totalBytes,
    droppedCount,
    totalSeen: tree.length,
  });
  } catch (e) {
    console.error("[/api/github/ingest] unexpected:", e instanceof Error ? e.message : String(e));
    return Response.json({
      error: "internal",
      detail: e instanceof Error ? e.message : "Unknown failure",
    }, { status: 500 });
  }
}
