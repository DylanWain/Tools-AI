import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /compare was the URL of the multi-LLM chat before it became the
  // home page. Permanent 301 so any external link (docs, social posts,
  // bookmarks) still lands on the right place AND search engines
  // collapse the duplicate URL into / in their index.
  async redirects() {
    return [
      { source: "/compare", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
