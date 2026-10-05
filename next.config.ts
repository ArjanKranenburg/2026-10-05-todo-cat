import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e dev server gets its own output dir so it can run next to `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
