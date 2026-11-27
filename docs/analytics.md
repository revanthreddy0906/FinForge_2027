# Product analytics (PostHog)

PostHog tracks how people move through the site, mainly the registration funnel. Vercel Web
Analytics and Speed Insights stay on alongside it: they count pageviews and Web Vitals with no
setup. PostHog also counts pageviews, so the two pageview numbers overlap. If PostHog ends up
covering what the team needs, `@vercel/analytics` can be removed later.

## How it runs

- **Production only.** It runs only when `NEXT_PUBLIC_POSTHOG_KEY` is set and `VERCEL_ENV` is
  `production`. Previews, e2e runs, load tests and ZAP scans never download the SDK.
- **Loaded late.** `posthog-js/no-external` (about 130 KB gzipped) loads after the `load`
  event, once the main thread is idle, from `src/instrumentation-client.ts`. A local mobile
  Lighthouse run with it on scored performance 99 on `/` and `/register`, with CLS 0 and no
  console errors.
- **First-party.** Events go to `/ingest/*` on our own domain, and `next.config.ts` rewrites
  them to `https://us.i.posthog.com`. So the CSP's `connect-src` stays `'self'`, and PostHog's
  external scripts (toolbar, recorder, surveys) are never loaded. `/ingest` is left out of the
  CSP proxy.
- **Trailing slashes.** PostHog's paths end in `/`, so Next's trailing-slash redirect is turned
  off (`skipTrailingSlashRedirect`). `src/proxy.ts` redirects `/page/` to `/page` for every page
  instead.

## Privacy

- **Cookieless** (`cookieless_mode: "always"`): no cookies, localStorage or sessionStorage, and no
  consent banner. Nobody is ever identified.
- **Do Not Track and Global Privacy Control**: when either is on, the SDK is not downloaded at all.
- **The organizer console** (`/admin`) is never tracked. The SDK doesn't load there, and events
  from it are dropped even after a client-side navigation.
- **Turned off:** session replay, surveys, product tours, heatmaps, dead clicks, feature flags,
  exception capture (Sentry covers errors) and performance capture (Speed Insights covers it).
- **Autocapture** records clicks only, with element text and attributes masked and never a
  field's value. The registration form and payment step also carry `ph-no-capture`.
- **`before_send`** (`scrubPostHogEvent`):
  - cuts query strings and fragments from every URL;
  - masks emails and phone numbers in every string, using the same masks as Sentry
    (`src/lib/monitoring/scrub.ts`);
  - drops person properties.

## Funnel events (`src/lib/analytics/track.ts`)

Event properties are counts and booleans only. Never pass a name, email, phone, team name or
reference.

| Event                          | When                                       | Properties                          |
| ------------------------------ | ------------------------------------------ | ----------------------------------- |
| `registration_form_started`    | First edit in the form                     | none                                |
| `registration_form_invalid`    | Submit blocked by client validation        | `field_error_count`                 |
| `registration_submitted`       | Valid form sent to the server              | `member_count`                      |
| `registration_server_error`    | Server rejected it (duplicate, full, etc.) | `field_error_count`                 |
| `registration_payment_shown`   | Team saved, payment step shown             | `member_count`                      |
| `registration_payment_opened`  | Razorpay pop-up opened                     | none                                |
| `registration_payment_problem` | Pop-up closed unpaid or verify failed      | `failed_in_popup` / `verify_failed` |
| `registration_completed`       | Team confirmed                             | `paid_now`                          |

## Setup (one time, in PostHog and Vercel)

1. In PostHog (US), open Project settings, then Web analytics or Product analytics, and turn on
   **Cookieless server hash mode**. Without it, PostHog silently drops every event this site
   sends.
2. In the same settings, turn on **Discard client IP data** if you don't want city-level location.
3. In Vercel, add `NEXT_PUBLIC_POSTHOG_KEY` (the project API key, `phc_...`) for **Production
   only**, then redeploy. The key is inlined at build time.
4. To check a local production build, set `NEXT_PUBLIC_POSTHOG_KEY` and
   `NEXT_PUBLIC_POSTHOG_LOCAL_TEST=1`. That flag is ignored on every Vercel deployment.

Note: PostHog drops events from automated browsers (Playwright, Lighthouse, k6 browsers).
Cookieless unique-visitor counts depend on PostHog seeing each visitor's IP through Vercel's
rewrite. Check this in the PostHog live events view after the first production deploy.
