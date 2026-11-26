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

## Pending

- Branch protection on `main` requiring the CI checks (needs the first CI run on GitHub)
- Step 2 onward from the build order (design system next)
- CI steps still to add as their features land: Playwright, Lighthouse CI, Semgrep, ZAP baseline

## Known issues and notes

- ESLint stays on v9: Next's bundled React, import and jsx-a11y plugins don't support ESLint 10 yet.
- TypeScript stays on 5.x: typescript-eslint doesn't support TypeScript 7 yet.
- `fsevents` install script is not approved under npm's install-scripts policy. It is an optional
  macOS file-watcher and isn't needed.
