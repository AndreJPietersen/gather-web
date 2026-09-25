import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are consumed as TypeScript source, so Next compiles them.
  transpilePackages: ["@gather/db", "@gather/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  // Next.js blocks cross-origin requests to dev-only assets by default —
  // a phone hitting the dev server via its LAN IP is a different origin
  // than localhost, so without this every JS chunk request gets silently
  // blocked and the page never hydrates past its raw server-rendered shell.
  allowedDevOrigins: ["192.168.31.140"],
};

export default nextConfig;
