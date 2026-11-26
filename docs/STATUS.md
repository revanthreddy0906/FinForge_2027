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

- **Step 2, design system (in progress)**
  - Art direction chosen: Secure Ledger (Bodoni Moda + Inter, teal/cream, yellow accent)
  - Figma file with variables (color, type, spacing, radius, motion), text styles, Foundations page
    and core components (see `docs/design-system.md`)
  - Tokens mirrored in `src/app/globals.css` (Tailwind v4 `@theme`) and `src/design/tokens.ts`,
    with a sync + contrast test; fonts via `next/font` (Bodoni Moda, Inter)

## Pending

- Home page and motion designs in Figma (desktop + 360px), then approval
- React components, Code Connect and home page build (step 4)
- CI steps still to add as their features land: Playwright, Lighthouse CI, Semgrep, ZAP baseline

## Known issues and notes

- ESLint stays on v9: Next's bundled React, import and jsx-a11y plugins don't support ESLint 10 yet.
- TypeScript stays on 5.x: typescript-eslint doesn't support TypeScript 7 yet.
- The gitleaks version in CI is pinned by hand (with its SHA-256); Dependabot won't bump it.
- Figma is on the Starter plan with a View seat: one mode per variable collection (mobile values are
  separate `-mobile` variables), 3 pages per file, and the Figma MCP read tools are limited to about
  20 calls a month. A Professional plan with a Full or Dev seat removes these limits.
- `fsevents` install script is not approved under npm's install-scripts policy. It is an optional
  macOS file-watcher and isn't needed.
