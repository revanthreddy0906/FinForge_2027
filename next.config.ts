import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The Content-Security-Policy is per request (it carries a nonce) and is set in src/proxy.ts.
  headers() {
    const consoleHeaders = [
      // Organizer console: never indexed, never cached by shared caches.
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "private, no-store" },
    ];
    return Promise.resolve([
      { source: "/:path*", headers: [...securityHeaders] },
      // Razorpay opens bank and UPI pages in pop-ups that report back to the page that opened
      // them, which "same-origin" would cut off. Only the payment page relaxes this.
      {
        source: "/register",
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }],
      },
      { source: "/admin", headers: consoleHeaders },
      { source: "/admin/:path*", headers: consoleHeaders },
    ]);
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

// Sentry (errors only). Source maps upload only when SENTRY_AUTH_TOKEN is set (Vercel production
// builds) and are deleted from the build afterwards, so they are never served publicly.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  // No tracing, so router transitions aren't recorded (see src/instrumentation-client.ts).
  suppressOnRouterTransitionStartWarning: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  // Leave out the SDK code for features we don't use, to keep the browser bundle small.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
