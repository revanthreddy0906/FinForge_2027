# Project status

Last updated: 2026-11-27

## Done

- **Step 1, repo setup**
  - Next.js 16.4 App Router + React 19.3 + Tailwind CSS 4.3, `src/` layout, `@/*` alias
  - TypeScript strict with `noUncheckedIndexedAccess`, `noImplicitOverride`,
    `noFallthroughCasesInSwitch`, `noImplicitReturns`
  - ESLint 9: Next.js core-web-vitals + typescript-eslint `strictTypeChecked` and
    `stylisticTypeChecked` + `eslint-plugin-security`, `--max-warnings=0`
  - Prettier with Tailwind class sorting
  - Vitest, with `formatINR` (Indian digit grouping) and its tests
  - Husky + lint-staged pre-commit: lint and format staged files, then full typecheck
  - GitHub Actions CI: typecheck, lint, format check, unit tests, build, npm audit, gitleaks
  - Dependabot for npm and GitHub Actions (weekly)
  - Pushed to GitHub; first CI runs green
  - Branch protection on `main`: PRs required, the 3 CI checks must pass and be up to date,
    linear history, no force pushes or deletion; admin bypass kept for emergencies

- **Step 2, design system**
  - Art direction chosen: Secure Ledger (Bodoni Moda + Inter, teal/cream, yellow accent)
  - Figma file with variables (color, type, spacing, radius, motion), text styles, Foundations page
    and core components (see `docs/design-system.md`)
  - Tokens mirrored in `src/app/globals.css` (Tailwind v4 `@theme`) and `src/design/tokens.ts`,
    with a sync + contrast test; fonts via `next/font` (Bodoni Moda, Inter)

- **Step 3, home page design**: desktop + 360px in Figma, approved. Motion is specified in
  `docs/motion.md` and built in code (Figma motion blocked by the Starter plan's MCP call limit).
- **Step 4, home page in code**
  - Event facts in `src/config/event.ts` (unknowns stay `null`/TODO, nothing guessed)
  - UI components in `src/components/ui`, sections in `src/components/home`, motion in
    `src/components/motion` (Motion 14 + CSS keyframes and a CSS scroll-driven timeline rail)
  - Skip link, 404 and error pages; contact email only revealed on click

- **Step 5, Supabase schema** (ADR `docs/adr/0001-registration-database.md`)
  - Tables `teams`, `team_members`, `contact_messages`, view `admin_registrations`; private
    `event_settings` (team cap, currently none) and `admin_allowlist`
  - All writes go through `register_team` (service role only); `anon` and `authenticated` have no
    write access; allow-listed admins read through RLS
  - Supabase advisors: 0 security and 0 performance findings; rule and access test
    `supabase/tests/registration_rules.sql`: 23/23 pass
  - Types in `src/lib/supabase/database.types.ts` (generated, excluded from ESLint)

- **Step 6, team registration** (`/register`)
  - Form in the Secure Ledger style: team, college, 2 to 5 members, leader mobile, privacy note
    with consent, Cloudflare Turnstile; inline errors plus an error summary; reference shown on
    success
  - Server action: registration state check, rate limit (5/min per IP, Upstash; in-memory only
    for local tests), Zod validation shared with the form, Turnstile verification, save through
    `register_team`, friendly messages for every database rule
  - No database read on render; `NEXT_PUBLIC_REGISTRATION_STATE` can force a
    state for staging previews and e2e tests
  - Staging Supabase project `FinForge_2027_staging` (ref `iylwxuxotglsshkaoayx`) with the same
    migrations, advisors clean
  - Tests: Vitest 55 pass; Playwright (desktop + 360px) 14 pass in CI, axe WCAG 2.1 AA 0
    violations, including the database flow tests (success, duplicate name, email in another
    team) against staging via the `E2E_SUPABASE_URL` and `E2E_SUPABASE_SECRET_KEY` secrets

- **Step 7, security headers + CSP** (ADR `docs/adr/0002-content-security-policy.md`)
  - Nonce-based CSP per request in `src/proxy.ts`: scripts only by nonce + `'strict-dynamic'`, no
    `unsafe-inline`/`unsafe-eval` in production; `frame-ancestors 'none'`, `object-src 'none'`,
    `base-uri`/`form-action 'self'`; Turnstile allowed for script and frame
  - Static headers in `next.config.ts`: HSTS (2 years, subdomains, no preload yet), nosniff,
    Referrer-Policy, X-Frame-Options DENY, Permissions-Policy, COOP
  - Pages now render per request (needed for nonces); no database reads on render
  - Tests: Vitest for the CSP builder; Playwright `e2e/security-headers.spec.ts` checks every
    header, a fresh nonce per response on every script, and zero CSP violations on `/`,
    `/register` (with Turnstile) and the 404 page, at desktop and 360px
- **Organizer console** (build step 7, `/admin`, ADR `docs/adr/0003-admin-console-auth.md`)
  - Sign-in with email + password, then an authenticator-app code (Supabase MFA, TOTP); first
    sign-in shows a QR code to set the app up. No emails are sent.
  - Rate limited (5/min per IP, Upstash) for both steps; one message for wrong email or password
  - Session in two httpOnly, SameSite=Strict cookies scoped to `/admin`; ends 12 hours after
    sign-in (checked from the token's signed `amr` times); expired access tokens are refreshed
    through `/admin/session`
  - Reads go through the organizer's own token, so RLS decides access. Migration
    `admin_requires_mfa`: `is_admin()` needs aal2, plus `current_user_is_admin()`. Applied to
    staging and production; advisors 0/0; SQL rule test 28/28 on staging
  - Teams table with search, counts, and CSV export (one row per member, formula-injection safe)
  - Not indexed: `noindex` metadata, `X-Robots-Tag`, `robots.txt` disallows `/admin`
  - Tests: Vitest (login flow, CSV, search, session age); Playwright no-DB (redirects, noindex,
    errors, rate limit, axe) and a staging flow (QR set-up, wrong code, table, CSV, sign out,
    password-only blocked) using test organizer `e2e-admin@example.com` (allow-listed in staging)

- **Vercel hosting** (`docs/deployment.md`)
  - Project `finforge-2027` linked to the GitHub repo; Node 24.x, functions in `bom1` (Mumbai)
  - Previews (every non-`main` branch) use the staging Supabase project and are behind Vercel
    Authentication; production env vars point at `FinForge_2027`
  - Production builds paused with an Ignored Build Step until launch is approved
  - Public env vars set; secrets (Supabase secret key, Turnstile secret, Upstash token) are added
    by hand in the dashboard
  - Preview checked: all security headers present, Turnstile script loads under the CSP
  - End-to-end on staging (27 Nov 2026, Safari): real Turnstile widget, server-side siteverify
    with action + hostname checks, Upstash rate limit, saved to the staging database (FF27-0043,
    2 members)

- **Registration fee with Razorpay** (`docs/adr/0004-registration-payments.md`)
  - ₹699 per member, computed on the server from the saved member count; Standard Checkout
    pop-up after the team is saved; one order per team, reused on retries
  - Unpaid teams hold their name and emails for 30 minutes; expired holds are released when a
    new registration needs them; late payments on released teams are listed for refund in the
    organizer console
  - `/api/payments/verify` (signature + payment fetched from Razorpay) and
    `/api/payments/webhook` (signed `payment.captured` / `order.paid`), both idempotent
  - CSP: Razorpay origins and its one fixed `<style>` hash only on `/register`; COOP
    `same-origin-allow-popups` on `/register`
  - Organizer console: payment status per team, paid filter, paid count and total collected,
    payment columns in the CSV, "Payments to refund" list
  - Tests: SQL rules on staging (payments 29/29, registration 28/28); Vitest (fees, signatures,
    schemas, start/confirm flow, register mapping, console labels); Playwright staging flow with
    a local Razorpay stand-in (pay, cancel, fail, reload-resume, held name)
  - Real test-mode run on a staging preview (27 Nov 2026, Chrome desktop and 360 px phone):
    netbanking success (team confirmed), bank failure (Razorpay retry screen, team stays
    unpaid), cancelled pop-up, lost confirmation recovered by the signed webhook and by
    "Check payment", replayed webhooks and checks (no double marking), forged signatures and a
    payment swapped onto another order (rejected), and a hold that expired after 31 minutes:
    a new team took the name and email, then the old team's late payment was recorded for a
    refund (FF27-0066). CI (including the staging e2e flow) green on `main`
  - Migrations applied to staging and production (27 Nov 2026). Production advisors: only the Auth leaked-password-protection warning

## Pending

- Content TODOs: exact dates, registration window, tracks, prize breakdown, sponsors, official logo SVG
- Code Connect: blocked by the Figma plan (needs a Dev/Full seat on Organization). Mapping table is
  ready in `docs/design-system.md`.
- Add Playwright and Lighthouse CI to the pipeline

## Verification (26 Nov 2026, production build, local)

- Lighthouse mobile, 3 runs (simulated throttling): Performance 93–95, Accessibility 100, Best
  Practices 100, SEO 100. FCP 0.9 s, LCP 1.9–2.7 s, TBT 170–230 ms, CLS 0. LCP is mostly React
  hydration on the simulated slow CPU; observed (unthrottled) LCP equals FCP.
- Playwright at 360 and 1440 (and 360 with reduced motion): no horizontal overflow, no console
  errors, all revealed content ends fully visible, axe-core WCAG 2.1 AA: 0 violations, keyboard
  order correct with visible focus, mobile menu traps focus and closes on Escape, organiser email
  absent from the HTML.
- CI steps still to add as their features land: Playwright, Lighthouse CI, Semgrep, ZAP baseline

## Known issues and notes

- Payments: the Razorpay webhook isn't created in the dashboard yet (Revanth). Previews are behind
  Vercel Authentication, so a staging webhook URL needs the protection bypass query parameter.
- Payments: test card payments couldn't be completed by the headless test browser (Continue
  does nothing); netbanking test payments work. Try the test card by hand once.
- Rate limits: the form allows 5 registrations a minute per IP. Teams on one campus Wi-Fi share
  an IP; check this in the load test.

- Database: before registration opens, restart the team reference counter (test runs use up
  numbers): `alter table public.teams alter column seq restart with 1;` when the table is empty.
- Database: the team cap (`event_full`) path is covered by unit tests on the server side, but not
  yet against a real database. Team cap number is TODO (Revanth to confirm).
- Registration needs real keys before launch: Supabase secret key, Turnstile secret key, Upstash
  Redis URL and token (see `.env.example`). Turnstile site key: the FinForge widget (hostname
  localhost for now; add the production domain in Cloudflare).
- Confirmation email is switched off: Resend needs a verified domain, and FinForge has none yet.
  The on-screen team reference is the proof of registration. See `src/lib/server/confirmation-email.ts`.
- CSP: the real Turnstile script loads on the Vercel preview with no CSP errors. The widget shows
  error 110200 until the deployment hostname is added to the Cloudflare widget. The
  securityheaders.com grade has to be taken on the public production URL (previews are protected).
- Vercel Hobby plan is for non-commercial use only; upgrade to Pro before launch.
- Razorpay UPI: the account currently has UPI (collect and QR) turned off; only UPI intent
  (app buttons on phones) is on (checked via `/v1/methods`, 27 Nov 2026). Nothing in our code
  restricts methods. Before launch, confirm in the dashboard (Account & Settings, Payment
  methods) or with Razorpay support that UPI is enabled in live mode after KYC.
- Razorpay webhook: previews are behind Vercel Authentication, so Razorpay cannot reach them.
  Create the dashboard webhook on the public production URL at launch.
- CSP: if browser code calls Supabase directly, set `NEXT_PUBLIC_SUPABASE_URL` so `connect-src`
  allows it. Sentry will need its ingest origin added.
- Organizer console set-up (both Supabase projects): create the organizer user under
  Authentication > Users > Add user (auto-confirm), turn off "Allow new users to sign up", and
  set `SUPABASE_PUBLISHABLE_KEY` on Vercel. The organizer email must be in
  `private.admin_allowlist`.
- CSP: the console's QR code is a `data:` image, so `img-src` must allow `data:`.
- Supabase free projects pause after a week of inactivity: keep `FinForge_2027` active or upgrade
  before registration opens.

- ESLint stays on v9: Next's bundled React, import and jsx-a11y plugins don't support ESLint 10 yet.
- TypeScript stays on 5.x: typescript-eslint doesn't support TypeScript 7 yet.
- The gitleaks version in CI is pinned by hand (with its SHA-256); Dependabot won't bump it.
- Figma is on the Starter plan with a View seat: one mode per variable collection (mobile values are
  separate `-mobile` variables), 3 pages per file, and the Figma MCP read tools are limited to about
  20 calls a month. A Professional plan with a Full or Dev seat removes these limits.
- `fsevents` install script is not approved under npm's install-scripts policy. It is an optional
  macOS file-watcher and isn't needed.
