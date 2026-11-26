# ADR-0003: Organizer console sign-in

**Status:** Accepted (2026-11-26)
**Date:** 2026-11-26
**Deciders:** Revanth (FinFoundry)

## Context

Organizers need a private page to view registered teams and export them as CSV. `CLAUDE.md`
asks for Supabase Auth, an allow-list of organizer emails, a rate-limited login, no indexing,
and a strict nonce CSP. FinForge has no email-sending domain, and Supabase's built-in email is
limited to a few messages an hour and only reaches the project team's own addresses.

## Options

1. **Magic link / email OTP.** Needs reliable email; ruled out without a domain.
2. **Sign in with Google (OAuth).** No password, but needs a Google Cloud OAuth client, and the
   login step happens at Google, so we can't rate limit it.
3. **Email + password, then an authenticator-app code (Supabase MFA, TOTP).** No email at all;
   login runs through our own server action; a stolen password alone is not enough.

## Decision

Option 3, chosen by Revanth.

- Login is one server action with two steps (password, then code), rate limited per IP with
  the shared Upstash limiter (5/min, fails closed). Sign-up is disabled in Supabase; the
  organizer user is created by hand in the dashboard.
- The first sign-in enrols a TOTP factor and shows its QR code (a `data:` SVG image) and key.
- Sessions are kept in two httpOnly, `Secure`, `SameSite=Strict` cookies with path `/admin`.
  Nothing session-related is readable by browser JavaScript, and no Supabase key reaches the
  browser. Expired access tokens are refreshed by the `/admin/session` route handler (Server
  Components can't set cookies). A session ends 12 hours after sign-in, using the signed `amr`
  times in the token. No `proxy.ts` is needed, so this stays independent of the CSP work.
- Reads use the organizer's own access token with the publishable key. Row Level Security is the
  real gate: `private.is_admin()` now requires an allow-listed email **and** `aal = 'aal2'`.
  `public.current_user_is_admin()` lets the page say "no organizer access" instead of showing an
  empty table. The service-role key is not used by the console.
- CSV export is a route handler with the same checks. Every cell is quoted, and cells that start
  with `= + - @`, tab or carriage return get a leading apostrophe (CSV injection).
- `/admin` is `noindex` (metadata and `X-Robots-Tag`), `private, no-store`, and disallowed in
  `robots.txt`.

Dependency note: `@supabase/ssr` was not added. The console sets its own cookies from server
actions and one route handler, which is a few lines and avoids coupling to middleware.

## Consequences

- Organizers need an authenticator app. Losing the phone means an organizer with database access
  removes the factor (`auth.mfa_factors`) so the next sign-in sets it up again.
- The CSP must allow `data:` in `img-src` for the QR code.
- E2E tests use a staging-only organizer, `e2e-admin@example.com`, recreated on each run.
