/**
 * Security headers for every response, and the per-request Content-Security-Policy.
 *
 * The CSP is built per request in `src/proxy.ts` because it carries a fresh nonce. Everything
 * else is static and set in `next.config.ts`, so it also covers files served from `_next/static`.
 */

/** Cloudflare Turnstile serves its script and its challenge iframe from this origin. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export interface CspOptions {
  /** Base64 nonce, fresh for every request. */
  nonce: string;
  /** `next dev` needs `'unsafe-eval'` for React's debug tooling. Never in production. */
  isDev: boolean;
  /** Ask browsers to load every subresource over HTTPS. Only on HTTPS requests. */
  upgradeInsecureRequests: boolean;
  /**
   * Extra origins the browser may call with fetch or WebSocket, e.g. the Supabase project URL
   * once the browser talks to Supabase Auth directly. Must be full https:// origins.
   */
  connectOrigins?: readonly string[];
}

/** A nonce must be unguessable and new per request: 128 random bits, base64 encoded. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Turns an https:// origin into its wss:// twin, for Supabase Realtime and similar sockets. */
function socketOrigin(origin: string): string {
  return origin.replace(/^https:/, "wss:");
}

export function buildCsp({
  nonce,
  isDev,
  upgradeInsecureRequests,
  connectOrigins = [],
}: CspOptions): string {
  const https = connectOrigins.filter((o) => o.startsWith("https://"));
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    // 'strict-dynamic' lets our nonced scripts load others (Next.js chunks, the Turnstile script
    // added by the form). The host and 'self' are fallbacks for browsers without CSP level 3;
    // modern browsers ignore them once 'strict-dynamic' is present.
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      TURNSTILE_ORIGIN,
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Style elements need the nonce. Style attributes stay allowed: Motion and our CSS custom
    // properties (--i stagger index) render them, and an attribute cannot run script.
    // (`next dev` injects un-nonced style tags for its overlay and hot reload, so dev relaxes this.)
    ["style-src", "'self'", isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`],
    ["style-src-attr", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...https, ...https.map(socketOrigin)],
    ["frame-src", TURNSTILE_ORIGIN],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["media-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  if (upgradeInsecureRequests) directives.push(["upgrade-insecure-requests"]);
  return directives.map((d) => d.join(" ")).join("; ");
}

/** Static headers for every response. Graded by securityheaders.com alongside the CSP. */
export const securityHeaders: readonly { key: string; value: string }[] = [
  // Two years, all subdomains. Add `preload` only once the final domain is chosen, because
  // getting off the browser preload list takes months.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Older browsers that ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "bluetooth=()",
      "hid=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "display-capture=()",
      "browsing-topics=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];
