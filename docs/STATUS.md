# Project status

Last updated: 2026-11-26

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
  - Page is static (no database read on render); `NEXT_PUBLIC_REGISTRATION_STATE` can force a
    state for staging previews and e2e tests
  - Staging Supabase project `FinForge_2027_staging` (ref `iylwxuxotglsshkaoayx`) with the same
    migrations, advisors clean
  - Tests: Vitest 55 pass; Playwright (desktop + 360px) 14 pass in CI, axe WCAG 2.1 AA 0
    violations, including the database flow tests (success, duplicate name, email in another
    team) against staging via the `E2E_SUPABASE_URL` and `E2E_SUPABASE_SECRET_KEY` secrets

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

- Database: before registration opens, restart the team reference counter (test runs use up
  numbers): `alter table public.teams alter column seq restart with 1;` when the table is empty.
- Database: the team cap (`event_full`) path is covered by unit tests on the server side, but not
  yet against a real database. Team cap number is TODO (Revanth to confirm).
- Registration needs real keys before launch: Supabase secret key, Turnstile secret key, Upstash
  Redis URL and token (see `.env.example`). Turnstile site key: the FinForge widget (hostname
  localhost for now; add the production domain in Cloudflare).
- Confirmation email is switched off: Resend needs a verified domain, and FinForge has none yet.
  The on-screen team reference is the proof of registration. See `src/lib/server/confirmation-email.ts`.
- CSP (build step 4) must allow `https://challenges.cloudflare.com` for script and frame.
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
