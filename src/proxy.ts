import { type NextRequest, NextResponse } from "next/server";
import { buildCsp, createNonce } from "@/lib/security/headers";

/**
 * Sets a nonce-based Content-Security-Policy on every page. Next.js reads the nonce from the
 * request's CSP header and adds it to its own scripts, so pages render per request (see
 * `docs/adr/0002-content-security-policy.md`). The static security headers live in
 * `next.config.ts`.
 */
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    upgradeInsecureRequests: request.nextUrl.protocol === "https:",
    connectOrigins: supabaseUrl ? [new URL(supabaseUrl).origin] : [],
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
      // Pages only: static chunks, optimised images and metadata files need no CSP.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
