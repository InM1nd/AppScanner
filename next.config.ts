import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Lystio's search-page crawl launches headless Chromium via
  // @sparticuz/chromium + playwright-core on Vercel (see lystio.ts) — both
  // ship native binaries that Next's bundler must not try to trace/inline.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
};

export default nextConfig;
