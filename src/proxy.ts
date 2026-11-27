import { type NextRequest, NextResponse } from "next/server";
import { sentryEnabled, sentryIngestOrigin } from "@/lib/monitoring/sentry-options";
import { buildCsp, createNonce } from "@/lib/security/headers";

/**
 * Sets a nonce-based Content-Security-Policy on every page. Next.js reads the nonce from the
 * request's CSP header and adds it to its own scripts, so pages render per request (see
 * `docs/adr/0002-content-security-policy.md`). The static security headers live in
 * `next.config.ts`.
 */
/** The payment step runs on /register, so only that page may load Razorpay Checkout. */
function isRegisterPage(pathname: string): boolean {
  return pathname === "/register" || pathname.startsWith("/register/");
}

export function proxy(request: NextRequest) {
  // next.config.ts turns off Next's own trailing-slash redirect for PostHog's sake, so pages
  // keep one canonical URL here: /register/ -> /register.
  const { pathname } = request.nextUrl;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    // A plain URL: NextURL would put the trailing slash back when formatting.
    const url = new URL(request.url);
    url.pathname = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  const nonce = createNonce();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    upgradeInsecureRequests: request.nextUrl.protocol === "https:",
    connectOrigins: supabaseUrl ? [new URL(supabaseUrl).origin] : [],
    razorpay: isRegisterPage(request.nextUrl.pathname),
    // Browser errors go straight to Sentry, only where Sentry is switched on.
    reportOrigin: sentryEnabled() ? sentryIngestOrigin() : null,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: static chunks, optimised images, metadata files and the PostHog proxy
      // (/ingest, rewritten in next.config.ts) need no CSP.
      source:
        "/((?!_next/static|_next/image|ingest/|ingest$|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
