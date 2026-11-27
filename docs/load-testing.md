# Load testing (k6)

Scripts are in `loadtest/`. Run them against a **staging preview only**, never production and
never while real registration is open. `lib.js` refuses the production URL.

## Results (27 Nov 2026, 07:50 to 08:15 IST)

Target: a Vercel preview of `main` (functions in `bom1`, staging Supabase
`iylwxuxotglsshkaoayx`, Razorpay **test** mode). Load came from one test machine (one public IP),
with k6 2.4.

| Test                                                    | Load                                                                               | Result                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch day (`launch-day.js`)                            | 1,000 visitors (ramp 1 min, hold 4 min) + 150 teams registering in the same window | **Pass.** 76,669 requests, **0 errors**. p95: home 300 ms, `/register` 295 ms, static CSS 33 ms. Register submit p95 591 ms (avg 399 ms). 150/150 teams reached payment with a Razorpay order                                     |
| Stress (`stress.js`)                                    | 0 to 2,000 visitors in 4 min, hold 2,000 for 2 min                                 | Served pages stayed at p95 299 ms at every step up to 2,000. 1.6% of requests (2,162 of 138,728) got "connection refused", **only at 2,000 VUs, caused by the test machine's network** (below)                                    |
| Registration spike (`registration-spike.js`)            | 75 teams press Register in the same second, plus 10 teams racing for one name      | Before the fix: 26 of 75 got "couldn't start the payment" (Razorpay HTTP 429), seen twice. After the fix: **75/75 on the first try**, submit p95 2.95 s. Name race: exactly 1 winner, 9 told the name is held                     |
| Rate limit (`rate-limit-check.js`, no load-test secret) | 7 submits in a row from one IP, then 3 with forged `X-Forwarded-For` / `X-Real-IP` | Refused with the friendly message from the 5th or 6th submit inside a minute (the sliding window also counts the previous minute's submits). Forged IP headers are still refused (Vercel sets the client IP; it can't be spoofed) |

Database checks after the launch-day run: 150 teams, 150 distinct idempotency keys, 150 payment
rows with 150 distinct Razorpay orders, no team with two orders. The 10% of registrants who
re-submitted (double click) got the same order back.

Against the CLAUDE.md pass condition (1,000 VUs, p95 < 500 ms, errors < 1%): **public pages pass**
with a wide margin. The registration submit is above 500 ms at p95 (591 ms) because one submit
runs, in order, the Upstash rate limit, Turnstile siteverify, the Supabase `register_team` call,
a Supabase read and a Razorpay order. That is a single form submit per team, so 0.6 s is fine
for users; it is listed here so the number isn't hidden.

### The 2,000-VU connection refusals were on our side

At 2,000 concurrent connections, new connections from the test Mac started failing with
`connect: connection refused` while requests that did connect were as fast as before. During a
second 2,000-VU hold, `curl` from the same Mac to **cloudflare.com and vercel.com also failed**
(13 of 15 and 15 of 15 attempts), and Vercel reported no attack anomalies or mitigations for the
project. So the limit was the test machine's own network (its NAT / connection table), not Vercel.
We did not find the site's breaking point: up to 2,000 visitors (~540 requests/s) it showed no
degradation. Finding the real ceiling needs load from several machines (for example Grafana
Cloud k6), which isn't needed for an event of ~1,000 peak visitors.

### Fixed: Razorpay throttles bursts of order creation

With 75 submits in the same second, Razorpay test mode accepted about 50 order creations and
answered the rest with HTTP 429. The teams were saved, but saw "couldn't start the payment, press
Register team again". Pressing again worked for all of them. `createOrder` now retries **only
429s**, up to 3 times with jittered 300/700/1500 ms delays (`src/lib/payments/retry.ts`). A
throttled request creates nothing, so the retry can't make a second order. Live-mode limits may
differ; the retry covers both. The failure logs now also include the HTTP status and Razorpay's
reason code.

### Notes and open points

- **Campus Wi-Fi and the 5-a-minute limit.** Teams on one college network share one public IP,
  and the form allows 5 submits a minute per IP (Turnstile already stops bots). If 6+ teams from
  one campus submit in the same minute, the 6th is asked to wait a minute. Consider raising the
  register limit (for example to 20 a minute); it is a one-line change in
  `src/app/register/actions.ts` (the limit argument of `allowRequest`). Not changed here: it's a product decision.
- A freshly deployed build was slower on its first burst (spike submit p95 4.3 s), then 2.95 s
  once warm. Open the site once after each deploy before announcing registration.
- Vercel usage: the runs sent about 275,000 requests to the preview. On the Hobby plan, check the
  Usage page; see the "upgrade to Pro" note in `docs/deployment.md`.
- Razorpay: about 510 **test** orders were created and can't be deleted (Razorpay has no delete).
  No payment was made.
- Staging team references (`FF27-xxxx`) advanced by ~540. Restart the counter before launch (see
  `docs/STATUS.md`).

## How the tests get past Turnstile, the rate limit and Vercel protection

Nothing in production is weakened. Everything below is scoped to one preview branch.

1. **Vercel Authentication:** a temporary "Protection Bypass for Automation" secret (Project >
   Settings > Deployment Protection), sent as the `x-vercel-protection-bypass` header. Revoke it
   after the run.
2. **Turnstile:** branch-scoped preview variables on the load-test branch only:
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`,
   `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (Cloudflare's always-pass test keys)
   and `TURNSTILE_HOSTNAMES=,` (hostname check off). The scripts send Cloudflare's dummy token,
   which only the test secret accepts. The server still calls siteverify on every submit.
3. **Rate limit:** k6 sends every request from one IP, so the 5-a-minute limit would stop the
   test after 5 teams. With `FINFORGE_LOAD_TEST_SECRET` (32+ random characters) set as a
   branch-scoped preview variable, a request carrying it in `x-finforge-load-test` is limited per
   `x-finforge-load-test-client` id instead of per IP (`src/lib/server/load-test.ts`). The limiter
   still runs with the same limit. It is ignored unless `VERCEL_ENV` is `preview`, so it can't
   work in production even if the variable leaked there.

## Running it

```sh
brew install k6
git push origin main:refs/heads/loadtest/k6   # then add the branch-scoped variables above, and push again to rebuild
ulimit -n 20000
export BASE_URL=https://<preview-url> VERCEL_BYPASS=<bypass secret> LOAD_TEST_SECRET=<FINFORGE_LOAD_TEST_SECRET>
VERCEL_BYPASS=$VERCEL_BYPASS NODE_PATH=node_modules node loadtest/capture-action.mjs $BASE_URL   # prints next-action
export ACTION_ID=<next-action from above>
k6 run loadtest/rate-limit-check.js      # never sends the load-test secret
k6 run -e RUN=k6lt-launch loadtest/launch-day.js
k6 run loadtest/stress.js
k6 run -e RUN=k6lt-spike loadtest/registration-spike.js
```

Every test team is named `k6lt …` with `k6lt-…@example.com` emails. Afterwards run
`loadtest/cleanup.sql` on **staging** (it checks that 0 rows are left before committing), revoke
the bypass secret, delete the four branch variables and the `loadtest/k6` branch.

Summaries of the runs above are in `loadtest/results/`.
