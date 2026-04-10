import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid double useEffect / double fetch in dev (React Strict Mode remounts).
  // Production builds are unaffected; re-enable if you want strict double-invoke checks.
  reactStrictMode: false,
};

export default nextConfig;
