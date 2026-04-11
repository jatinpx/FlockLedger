import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid double useEffect / double fetch in dev (React Strict Mode remounts).
  // Production builds are unaffected; re-enable if you want strict double-invoke checks.
  reactStrictMode: false,

  // Static export — all API calls are client-side (browser fetch), so no SSR needed.
  // This produces an `out/` directory that Cloudflare Pages can deploy directly.
  output: "export",

  // Required for static export: disable image optimisation (no server to run it).
  images: { unoptimized: true },
};

export default nextConfig;
