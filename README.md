# FinForge 2027

Official website for **FinForge 2027**, a Fraud Detection and Cybersecurity hackathon run by the
FinFoundry club at Jubilee Hills Convention Centre, Hyderabad, in March 2027.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Vitest ·
ESLint (typescript-eslint strict type-checked + eslint-plugin-security) · Prettier.

Supabase, Turnstile, Upstash, Resend and Sentry are added in later build steps.

## Getting started

Requires Node.js 24 or newer (see `.nvmrc`).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script                 | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Dev server                                             |
| `npm run build`        | Production build                                       |
| `npm run typecheck`    | Generates route types, then `tsc --noEmit`             |
| `npm run lint`         | ESLint with zero warnings allowed                      |
| `npm run format`       | Format everything with Prettier                        |
| `npm run format:check` | Check formatting without writing                       |
| `npm test`             | Vitest unit tests                                      |
| `npm run check`        | Typecheck, lint, format check and tests in one command |

A Husky pre-commit hook runs ESLint and Prettier on staged files, then a full typecheck. Commits
that fail any of these are blocked.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request:
typecheck → lint → format check → unit tests → build, plus `npm audit --audit-level=high` and a
gitleaks secret scan. Dependabot opens weekly update PRs for npm packages and GitHub Actions.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit real values. Only `NEXT_PUBLIC_*` variables
reach the browser.

## Project status

See [`docs/STATUS.md`](docs/STATUS.md).
