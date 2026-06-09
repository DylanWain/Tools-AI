/**
 * Pure browser-side preview builder. Takes the user's virtual project
 * and returns a single self-contained HTML string ready to drop into
 * an iframe via `srcdoc`. No network call, no server, no daemon — the
 * preview renders in a sandboxed iframe on this domain, the same way
 * Claude artifacts and ChatGPT canvas previews work.
 *
 * Capabilities (in order of preference):
 *   1. Has index.html → use it, inline any local <link>/<script> refs
 *   2. Has *.html (no index) → use the first one
 *   3. No HTML but has JSX/TSX → synthesize a React wrapper with
 *      react/react-dom from esm.sh CDN, transpile inline via Babel
 *      standalone (also CDN) so the iframe runs without a bundler
 *   4. No HTML but has plain JS/CSS → synthesize a minimal HTML
 *      wrapper that inlines the JS as a module + CSS as a <style>
 *   5. Has package.json with framework deps (next, vite, etc.) →
 *      return needs-bridge — these projects need a real dev server
 *
 * The returned HTML is meant to live inside
 *   <iframe sandbox="allow-scripts" srcdoc={result.srcdoc} />
 * so the iframe is isolated from the parent (no cookie/storage access,
 * no top-window navigation). Same security posture Claude uses.
 */

import type { ProjectFile } from "./sessions";

export type IframePreview =
  | { kind: "html"; srcdoc: string; entry: string }
  | { kind: "needs-bridge"; reason: string; detail: string }
  | { kind: "empty"; detail: string };

/** Frameworks that need a real bundler / dev server. If the project's
 *  package.json depends on any of these AND there's no pre-rendered
 *  HTML, we punt to the bridge daemon. */
const NEEDS_BRIDGE_DEPS = new Set([
  "next", "nuxt", "remix", "gatsby",            // SSR frameworks
  "vite", "@vitejs/plugin-react",               // bundlers (when no index.html in dist)
  "webpack", "parcel", "rollup", "esbuild",
  "electron", "@electron/forge",                // native runtime
  "@expo/cli", "react-native",                  // native runtime
]);

const HTML_EXTS = [".html", ".htm"];
const CSS_EXTS = [".css"];
const JS_EXTS = [".js", ".mjs"];
const JSX_EXTS = [".jsx", ".tsx", ".ts"];

export function buildIframePreview(project: Record<string, ProjectFile>): IframePreview {
  const files = Object.values(project);
  if (files.length === 0) {
    return { kind: "empty", detail: "Generate some code first — the workspace is empty." };
  }

  // 1) Framework-needs-bridge gate.
  const pkg = findPackageJson(files);
  if (pkg) {
    const bridgeDep = needsBridgeDep(pkg);
    const hasPrebuilt = files.some((f) => endsWithAny(f.path, HTML_EXTS));
    if (bridgeDep && !hasPrebuilt) {
      return {
        kind: "needs-bridge",
        reason: bridgeDep,
        detail: `Project uses ${bridgeDep}, which needs a real dev server (npm install + bundler). The Bridge daemon on your Mac can run this — pair one at /pair-bridge.`,
      };
    }
  }

  // 2) HTML entry — prefer index.html, fall back to first *.html.
  const indexHtml = files.find((f) => baseName(f.path).toLowerCase() === "index.html");
  const anyHtml = indexHtml ?? files.find((f) => endsWithAny(f.path, HTML_EXTS));
  if (anyHtml) {
    return {
      kind: "html",
      srcdoc: inlineLocalRefs(anyHtml.content, files),
      entry: anyHtml.path,
    };
  }

  // 3) React-ish — has .jsx/.tsx → synthesize a CDN React shell.
  const jsxFiles = files.filter((f) => endsWithAny(f.path, JSX_EXTS));
  if (jsxFiles.length > 0) {
    return {
      kind: "html",
      srcdoc: buildReactShell(jsxFiles, files),
      entry: jsxFiles[0].path,
    };
  }

  // 4) Plain JS — synthesize a minimal HTML wrapper.
  const jsFiles = files.filter((f) => endsWithAny(f.path, JS_EXTS));
  if (jsFiles.length > 0) {
    return {
      kind: "html",
      srcdoc: buildPlainJsShell(jsFiles, files),
      entry: jsFiles[0].path,
    };
  }

  // 5) Only CSS or only Markdown / unknown — show a friendly stub.
  return {
    kind: "html",
    srcdoc: buildStubShell(files),
    entry: files[0].path,
  };
}

// ─── helpers ────────────────────────────────────────────────────────

function findPackageJson(files: ProjectFile[]): Record<string, unknown> | null {
  const pkg = files.find((f) => baseName(f.path) === "package.json");
  if (!pkg) return null;
  try { return JSON.parse(pkg.content) as Record<string, unknown>; }
  catch { return null; }
}

function needsBridgeDep(pkg: Record<string, unknown>): string | null {
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  for (const name of Object.keys(deps)) {
    if (NEEDS_BRIDGE_DEPS.has(name)) return name;
  }
  return null;
}

function endsWithAny(path: string, exts: string[]): boolean {
  const lower = path.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

/** Inline `<link rel="stylesheet" href="./foo.css">` and
 *  `<script src="./foo.js">` references in the user's HTML so the
 *  iframe is fully self-contained. External URLs (https://...) are
 *  left as-is so CDN imports still work. */
function inlineLocalRefs(html: string, files: ProjectFile[]): string {
  const byPath = new Map<string, ProjectFile>();
  for (const f of files) byPath.set(normalizeRelPath(f.path), f);

  // <link rel="stylesheet" href="...">
  let out = html.replace(
    /<link\b([^>]*?)href=["']([^"']+)["']([^>]*)\/?>/gi,
    (match, before: string, href: string, after: string) => {
      if (!/rel=["']stylesheet["']/i.test(before + after)) return match;
      if (/^(https?:|\/\/|data:)/i.test(href)) return match;
      const file = byPath.get(normalizeRelPath(href));
      if (!file) return match;
      return `<style data-inlined-from="${escapeAttr(href)}">\n${file.content}\n</style>`;
    },
  );

  // <script src="..."></script>
  out = out.replace(
    /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (match, before: string, src: string, after: string) => {
      if (/^(https?:|\/\/|data:)/i.test(src)) return match;
      const file = byPath.get(normalizeRelPath(src));
      if (!file) return match;
      const typeAttr = /type=["'](module|application\/javascript)["']/i.test(before + after)
        ? ' type="module"' : "";
      return `<script${typeAttr} data-inlined-from="${escapeAttr(src)}">\n${file.content}\n</script>`;
    },
  );
  return out;
}

function normalizeRelPath(href: string): string {
  return href.replace(/^\.\//, "").replace(/^\//, "").trim().toLowerCase();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** CDN React + Babel standalone shell. Concatenates every JSX/TSX
 *  file into one inline module so simple single-file React previews
 *  Just Work. Real projects with imports between files won't work —
 *  but those tend to also be the projects that have an index.html
 *  generated anyway. */
function buildReactShell(jsxFiles: ProjectFile[], allFiles: ProjectFile[]): string {
  const cssBlock = allFiles
    .filter((f) => endsWithAny(f.path, CSS_EXTS))
    .map((f) => `<style data-from="${escapeAttr(f.path)}">\n${f.content}\n</style>`)
    .join("\n");
  // Pick the file most likely to be the entry: App.jsx/App.tsx/index.jsx > first
  const entry =
    jsxFiles.find((f) => /\b(app|index|main)\.(jsx|tsx|ts)$/i.test(f.path)) ?? jsxFiles[0];
  const otherJsx = jsxFiles.filter((f) => f !== entry);
  const concatenated = [...otherJsx, entry].map((f) => f.content).join("\n\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Preview</title>
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
${cssBlock}
</head><body>
<div id="root"></div>
<script type="text/babel" data-presets="react,typescript" data-type="module">
${concatenated}

// Auto-mount: if the file defined an "App" component but never mounted it,
// mount it for them. Same convenience Claude artifacts give you.
if (typeof App !== "undefined" && !document.querySelector("#root").firstChild) {
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
}
</script>
</body></html>`;
}

function buildPlainJsShell(jsFiles: ProjectFile[], allFiles: ProjectFile[]): string {
  const cssBlock = allFiles
    .filter((f) => endsWithAny(f.path, CSS_EXTS))
    .map((f) => `<style data-from="${escapeAttr(f.path)}">\n${f.content}\n</style>`)
    .join("\n");
  const jsBlock = jsFiles
    .map((f) => `<script type="module" data-from="${escapeAttr(f.path)}">\n${f.content}\n</script>`)
    .join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Preview</title>
${cssBlock}
</head><body>
<div id="root"></div>
${jsBlock}
</body></html>`;
}

function buildStubShell(files: ProjectFile[]): string {
  const list = files
    .map((f) => `<li><code>${escapeAttr(f.path)}</code></li>`)
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Preview</title>
<style>body{font-family:system-ui;color:#999;padding:32px;background:#0a0a0a;}h1{color:#fff;font-weight:500;font-size:14px;}li{margin:4px 0;font-size:12px;}</style>
</head><body>
<h1>Nothing to preview</h1>
<p>The project has no HTML, JS, or JSX files. The preview pane is reserved for things the browser can actually render. Files in the project:</p>
<ul>${list}</ul>
</body></html>`;
}
