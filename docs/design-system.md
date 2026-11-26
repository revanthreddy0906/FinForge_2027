# Design system

Figma is the source of truth: **FinForge 2027 Design System**
(https://www.figma.com/design/ieB9dqNMT0Pa3OJ1aTKMKe). Pages: Foundations, Components, Home.

## Direction: Secure Ledger

Private-bank and banknote feel. Cream Bodoni Moda headlines on deep teal, thin FinFoundry-yellow
hairline frames, diamond accents from the logo. Motion is slow, weighted and precise: mask-wipe
reveals, expo ease-out, no bounce. One dark theme, done well.

## Tokens: Figma ↔ code

| Figma variable        | CSS variable                                                                | Tailwind utility             | JS (`@/design/tokens`)         |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------- | ------------------------------ |
| `color/bg/canvas`     | `--color-bg-canvas`                                                         | `bg-bg-canvas`               | `tokens.color["bg/canvas"]`    |
| `color/text/primary`  | `--color-text-primary`                                                      | `text-text-primary`          | `tokens.color["text/primary"]` |
| `type/heading-1/size` | `--text-heading-1` (+ `--line-height`, `--letter-spacing`, `--font-weight`) | `text-heading-1`             | `tokens.type["heading-1"]`     |
| `spacing/lg`          | `--spacing-lg`                                                              | `p-lg`, `gap-lg`             | `tokens.spacing.lg`            |
| `radius/sm`           | `--radius-sm`                                                               | `rounded-sm`                 | `tokens.radius.sm`             |
| `duration/base`       | `--duration-base`                                                           | `duration-(--duration-base)` | `durationSeconds("base")`      |
| `easing/out-expo`     | `--ease-out-expo`                                                           | `ease-out-expo`              | `easingPoints("out-expo")`     |

- Every Figma variable's WEB code syntax is set to its CSS variable, so Dev Mode shows the code name.
- `src/app/globals.css` holds the CSS. `src/design/tokens.ts` holds the same values for JavaScript.
  `src/design/tokens.test.ts` fails if they drift and re-checks WCAG AA contrast.
- Tailwind's default palette, fonts, type scale, radii and easings are removed, so only tokens
  produce utilities.

### Breakpoints and the Figma Starter plan

The Figma Starter plan allows one mode per collection, so mobile values are separate variables with a
`-mobile` suffix (e.g. `type/heading-1/size-mobile`, `spacing/gutter-mobile`) and text styles come
in `Desktop/*` and `Mobile/*` pairs. Both point at the same CSS variable, which is mobile-first and
switches at `md` (48rem). Reduced-motion values are handled in CSS (`prefers-reduced-motion`): travel
distance 0, durations capped at 200ms, no stagger.

## Contrast rules (WCAG 2.1 AA)

- `text/primary`, `text/secondary`, `text/muted`, `text/accent`, `text/success`, `text/danger` pass
  4.5:1 on `bg/canvas`, `bg/surface` and `bg/raised`.
- On `bg/brand` only `text/primary` and `text/accent` pass. Never put secondary or muted text there.
- `decor/*` colors are decorative only, never text.
- Yellow is for the primary CTA, focus rings and hairline frames, not large fills.

## Components (Figma)

Logo, Button (Primary/Secondary/Ghost × Default/Hover/Pressed/Focus/Disabled), Badge (4 tones),
Input (Default/Focus/Error/Disabled), Section header (Left/Center), Card (Default/Highlight ×
Default/Hover), Timeline item (Past/Current/Upcoming), FAQ item (Collapsed/Expanded/Focus),
Nav (Desktop, Mobile closed, Mobile open). Each component's description in Figma documents its
states, motion and accessibility notes.

## Figma component ↔ React component

Code Connect needs a Dev or Full seat on an Organization or Enterprise plan; the Figma API refused
the mapping on the current Starter plan (26 Nov 2026). This table is the mapping to register once
the plan allows it (`add_code_connect_map` or `@figma/code-connect` files).

| Figma component | Node  | React component                            | Props ↔ variants                                   |
| --------------- | ----- | ------------------------------------------ | -------------------------------------------------- |
| Logo            | 4:2   | `Logo` in `src/components/ui/logo.tsx`     | none                                               |
| Button          | 4:54  | `ButtonLink` / `Button` in `ui/button.tsx` | `variant` = Primary/Secondary/Ghost; `arrow`       |
| Badge           | 4:68  | `Badge` in `ui/badge.tsx`                  | `tone` = Neutral/Accent/Success/Danger             |
| Input           | 4:90  | not built yet (registration form step)     |                                                    |
| Section header  | 5:16  | `SectionHeader` in `ui/section-header.tsx` | `align` = Left/Center; `index`, `eyebrow`, `title` |
| Card            | 5:38  | `Card` in `ui/card.tsx`                    | `highlight` = Highlight variant                    |
| Timeline item   | 5:64  | `TimelineItem` in `ui/timeline-item.tsx`   | `status` = Past/Current/Upcoming                   |
| FAQ item        | 5:87  | `FaqItem` in `ui/faq-item.tsx`             | `defaultOpen` = Expanded                           |
| Nav             | 5:151 | `SiteNav` in `src/components/site-nav.tsx` | breakpoint picks Desktop/Mobile; menu state        |

The logo in Figma is a typographic stand-in (₹ mark + Bodoni wordmark) until the official SVG is
supplied.
