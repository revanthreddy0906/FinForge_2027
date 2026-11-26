import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The Content-Security-Policy is per request (it carries a nonce) and is set in src/proxy.ts.
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: [...securityHeaders] }]);
  },
  reactStrictMode: true,
  turbopack: {
    // Pin the workspace root so a stray lockfile higher up the tree is never picked up.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
