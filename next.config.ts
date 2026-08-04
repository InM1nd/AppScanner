import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Lystio's search-page crawl launches headless Chromium via
  // @sparticuz/chromium + playwright-core on Vercel (see lystio.ts) — both
  // ship native binaries that Next's bundler must not try to trace/inline.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  // Next's default file tracer follows static require()/import() calls and
  // misses @sparticuz/chromium's bundled Chromium tarball and
  // playwright-core's browsers.json (both resolved via dynamic paths at
  // runtime) — without this, the deployed function is missing the binary
  // entirely (`Cannot find module .../browsers.json`). Only the Inngest
  // route ever launches Chromium (crawler.ts -> lystio.ts), so scope it
  // there rather than every route.
  outputFileTracingIncludes: {
    "/api/inngest": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/playwright-core/**/*",
    ],
  },
};

export default nextConfig;
