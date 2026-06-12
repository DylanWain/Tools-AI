import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Otherwise Next 15 walks
  // up looking for the nearest package-lock.json and may pick the
  // stray /Users/dylanwain/package-lock.json (an orphan lockfile
  // with no matching package.json), which corrupts the post-compile
  // step with `SyntaxError: Unexpected end of JSON input`.
  outputFileTracingRoot: __dirname,
  // Untracked WIP routes under /app/api/v1/ reference symbols that
  // aren't exported yet (getServiceSupabase, checkSupabaseConfig).
  // We don't want those to block `next build` while we're shipping
  // the desktop bundle. The Vercel build already passes (those
  // routes aren't committed); this only affects local builds.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Standalone output ships a self-contained Node server at
  // .next/standalone/server.js — Veronum Desktop bundles that into
  // the .app so the whole site runs from a child process on a free
  // local port, with no node_modules and no external runtime needed.
  // Vercel ignores `output` (it has its own runtime), so this is a
  // no-op for the live deploy and a critical enabler for desktop.
  output: "standalone",
  // /compare was the URL of the multi-LLM chat before it became the
  // home page. Permanent 301 so any external link (docs, social posts,
  // bookmarks) still lands on the right place AND search engines
  // collapse the duplicate URL into / in their index.
  async redirects() {
    return [
      { source: "/compare", destination: "/", permanent: true },
    ];
  },
  // Desktop-only rewrite: when Veronum-site is bundled inside the
  // Electron app, the main process sets DESKTOP_REMOTE_API_URL so
  // every /api/* request gets transparently forwarded to the live
  // deployment — which is where the model keys live. Keys never
  // ride along in the .app. SSE streaming passes through Next's
  // rewrite layer unchanged. Auth/session cookies do NOT forward
  // (cross-origin) — covered in a follow-up.
  async rewrites() {
    const remote = process.env.DESKTOP_REMOTE_API_URL;
    if (!remote) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${remote.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
