# ADR 0002: Nonce-based Content-Security-Policy, pages rendered per request

- Status: accepted (Revanth, 26 Nov 2026)
- Context: build step 4, CLAUDE.md section 6

## Decision

Every page gets a strict, nonce-based CSP built per request in `src/proxy.ts`
(`src/lib/security/headers.ts`). Scripts run only with the request's nonce plus `'strict-dynamic'`;
there is no `'unsafe-inline'` or `'unsafe-eval'` for scripts in production. The other security
headers (HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, COOP) are static and
set in `next.config.ts` so they also cover `_next/static` files.

To let Next.js stamp the nonce on its scripts, the root layout calls `connection()` and sets
`instant = false`, so every page renders per request and no static shell is prerendered.

## Why

- A nonce must change on every response, so the HTML cannot be a build-time file.
- The alternative, Next's experimental SRI (hash) mode, was tried on a test build: it hashes the
  external chunks but still leaves about 23 inline RSC payload scripts per page. A static CSP
  would then need `'unsafe-inline'` for scripts, which CLAUDE.md forbids. Hashing those inline
  scripts per build would need a fragile two-pass build.

## Consequences

- Public pages are no longer served as static HTML from the CDN. They still never query the
  database; JS, CSS and fonts stay immutable and edge-cached.
- Local sanity check (1 `next start` process, 4 cores): home page at about 90 requests/s, 100
  concurrent, 0 errors. On Vercel functions scale out, but the k6 test on staging (build step 10)
  must confirm the 1,000-user target.
- Zod's JIT is turned off (`z.config({ jitless: true })` in `src/lib/registration/schema.ts`): its
  `new Function` probe is reported as a CSP violation in the browser.
- Style attributes are allowed (`style-src-attr 'unsafe-inline'`) because Motion and our CSS custom
  properties render them; they cannot run script. Style elements need the nonce.
- `next dev` relaxes the policy (`'unsafe-eval'`, inline styles) for React's debug tooling and the
  dev overlay. Production never does.
- Turnstile needs `https://challenges.cloudflare.com` in `script-src` (fallback for old browsers)
  and `frame-src`. Its loader copies the page nonce onto its script tag.
- When the browser talks to Supabase directly (e.g. Supabase Auth on the admin page), set
  `NEXT_PUBLIC_SUPABASE_URL`; the proxy then adds that origin (https and wss) to `connect-src`.
- Add `preload` to HSTS only once the production domain is final.
- Sentry, when added, needs its ingest origin in `connect-src` (and optionally a `report-to`).
