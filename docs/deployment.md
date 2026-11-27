# Deployment (Vercel)

## Project

- Vercel project `finforge-2027` (Hobby plan), linked to `revanthreddy0906/FinForge_2027`.
- Framework Next.js, Node 24.x, Vercel Functions in `bom1` (Mumbai, next to Supabase `ap-south-1`).
- Domains: `finforge2027.vercel.app` (production) and `finforge2027-staging.vercel.app` (staging,
  pinned to the branch `claude/project-thread-gm74rs`). Both must be in the Turnstile widget's
  hostname list.
- Every push to a branch other than `main` builds a **preview** (staging). Previews are behind
  Vercel Authentication (Standard Protection), so only signed-in team members can open them.
- `main` is the production branch. **Production builds are paused** with an Ignored Build Step
  (Project Settings > Git > Ignored Build Step):

  ```sh
  if [ "$VERCEL_ENV" = "production" ]; then echo 'Production builds paused until launch is approved'; exit 0; else exit 1; fi
  ```

  Remove it (set it back to "Automatic") only after `engineering:deploy-checklist` passes and the
  launch is approved.

- Vercel Toolbar is off for previews and production: it injects `vercel.live` scripts, frames and
  inline styles that our CSP (rightly) blocks.

## Analytics

- Vercel Web Analytics (`@vercel/analytics`) and Speed Insights (`@vercel/speed-insights`) are in
  the root layout. Both are cookieless, load their script from our own origin (`/_vercel/*`) after
  the page, and need no CSP change (the scripts are added by our nonced code, so
  `'strict-dynamic'` allows them; data goes to `'self'`).
- They only render when `VERCEL=1`, because `/_vercel/*` doesn't exist in local or CI builds.
- Turn both on in the dashboard (Project > Analytics > Enable, Project > Speed Insights > Enable).
- PostHog (product analytics and the registration funnel) runs next to them, in production only,
  cookieless and first-party through `/ingest`. See `docs/analytics.md` for the one-time setup
  (turn on cookieless mode in PostHog, then add `NEXT_PUBLIC_POSTHOG_KEY` to Production).
- Bot Protection and BotID stay off: Turnstile already guards registration, and a platform bot
  challenge would block the k6 load test.

## Environment variables

| Variable                         | Production                  | Preview + Development               | Type                         |
| -------------------------------- | --------------------------- | ----------------------------------- | ---------------------------- |
| `SUPABASE_URL`                   | `FinForge_2027` project URL | `FinForge_2027_staging` project URL | plain                        |
| `SUPABASE_PUBLISHABLE_KEY`       | production publishable key  | staging publishable key             | plain                        |
| `SUPABASE_SECRET_KEY`            | production secret key       | staging secret key                  | **sensitive**, added by hand |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | FinForge widget             | same                                | plain                        |
| `TURNSTILE_SECRET_KEY`           | FinForge widget secret      | same                                | **sensitive**, added by hand |
| `UPSTASH_REDIS_REST_URL`         | Upstash database URL        | same                                | plain                        |
| `UPSTASH_REDIS_REST_TOKEN`       | Upstash token               | same                                | **sensitive**, added by hand |
| `TURNSTILE_HOSTNAMES`            | `finforge2027.vercel.app`   | `finforge2027-staging.vercel.app`   | plain                        |
| `NEXT_PUBLIC_REGISTRATION_STATE` | never set                   | `open` (preview only)               | plain                        |
| `RAZORPAY_KEY_ID`                | live key ID (`rzp_live_…`)  | test key ID (preview only)          | plain                        |
| `RAZORPAY_KEY_SECRET`            | live key secret             | test key secret (preview only)      | **sensitive**, added by hand |
| `RAZORPAY_WEBHOOK_SECRET`        | live webhook secret         | test webhook secret (preview only)  | **sensitive**, added by hand |

The branch `claude/project-thread-0e0o8b` also has branch-only overrides for Cloudflare's
always-pass Turnstile test keys (its preview URL is not on the widget's hostname list). Delete
them once payments are tested on `finforge2027-staging.vercel.app`.

`FINFORGE_ALLOW_MEMORY_RATE_LIMIT` and `RAZORPAY_API_BASE` are never set on Vercel.

Razorpay webhook (dashboard > Account & Settings > Webhooks, once in Test mode and once in Live
mode): URL `https://<site>/api/payments/webhook`, events `payment.captured` and `order.paid`,
and a secret that you then paste into `RAZORPAY_WEBHOOK_SECRET` for the same environment.

Secrets are added in the Vercel dashboard (Project > Settings > Environment Variables > Add,
"Sensitive" on), never pasted into chat or committed. A change to any variable only applies to
deployments built after it, so redeploy afterwards.

`NEXT_PUBLIC_*` values are inlined at build time.

## Error alerts (Sentry)

- Sentry project `finforge-2027` in the org `revanth-9h` (`@sentry/nextjs`, errors only: no
  tracing, replays, feedback widget or session pings).
- Runs only when the Vercel environment is `production`, so previews, e2e runs, load tests and
  scans never send events. `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` are set
  for Production only.
- Server errors (pages, server actions, the payment routes) are reported through
  `src/instrumentation.ts`. The browser SDK (about 50 KB gzipped) loads only after the page has
  loaded and the main thread is idle; the first-load JS grows by about 1 KB.
- Personal data is stripped in `beforeSend` (`src/lib/monitoring/scrub.ts`, with tests): no
  cookies, headers, form bodies, query strings or user fields; emails, phone numbers and tokens
  in messages are masked.
- The CSP allows the ingest origin in `connect-src` only where Sentry is on.
- Alert rules (email to the `revanth` team): "Errors: new, regressed or back" (at most every
  5 minutes per issue) and "Error spike: 20 events in 5 minutes". Install the Sentry app on your
  phone and turn on push notifications to get them there too.
- Source maps: uploaded only when `SENTRY_AUTH_TOKEN` (Sensitive, Production) is set, and deleted
  from the build after upload.
- Uptime monitors on `/`, `/register` and `/statements` are added once production is public.

## Checks on the preview

- Headers (checked 26 Nov 2026 on a preview): CSP with nonce + `'strict-dynamic'`, HSTS,
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  Permissions-Policy, COOP all present. securityheaders.com can't scan a protected preview (it
  grades the Vercel login page instead), so take the official grade on the public production URL.
- Turnstile script loads under the CSP. The widget needs the deployment hostname in the
  Cloudflare widget's hostname list (error 110200 otherwise).

## Before launch

- Upgrade to Vercel Pro: Hobby is for non-commercial personal use only, and a sponsored event site
  likely falls outside that.
- Keep the Supabase production project active (free projects pause after a week idle).
- Add the final domain to the Turnstile widget and to Vercel, then consider HSTS `preload`.
