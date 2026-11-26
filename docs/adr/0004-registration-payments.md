# ADR-0004: Registration fee with Razorpay Standard Checkout

**Status:** Accepted (2026-11-27)
**Date:** 2026-11-27
**Deciders:** Revanth (FinFoundry)

## Context

Teams pay a registration fee of ₹699 per member (a team of 2 to 5 pays ₹1,398 to ₹3,495).
Revanth chose Razorpay Standard Web Checkout, the pop-up modal, after comparing Cashfree,
Razorpay and Stripe (research page linked in project memory). The money must only be trusted
when Razorpay says so, a double click or retry must never charge twice, and a team that never
pays must not block its name and emails forever.

## Options

1. **Pay first, then register.** Needs the form data stored before payment anyway, and a
   failed save after a successful payment means a refund.
2. **Register first as unpaid, then pay (chosen).** The team is saved with
   `payment_state = 'pending'`, then the server creates the order from the saved member count.
3. **Payment Links / Payment Pages.** No integration work, but no link between a payment and
   a team without manual matching.

## Decision

Option 2, with Standard Checkout (Revanth's explicit choice).

- **Amount:** computed on the server from the saved member count (`payment_details`), never
  from the browser. One order per team (unique index on `payments.team_id`); a retry or second
  tab reuses it (`record_payment_order` returns the stored order if two requests race).
- **Holds:** an unpaid team keeps its name and emails for `payment_hold_minutes` (30, in
  `private.event_settings`). Expired holds are removed lazily, only when a new registration
  needs that name or an email (`private.release_expired_holds`), so there is no cron job.
  The team cap counts paid teams plus unexpired holds.
- **Confirmation (two paths, both idempotent):**
  - `/api/payments/verify`: the browser sends Razorpay's result. The server checks the HMAC
    signature with the key secret, fetches the payment from Razorpay, captures it if only
    authorized, and calls `mark_order_paid` with Razorpay's amount.
  - `/api/payments/webhook`: signed `payment.captured` / `order.paid` events (HMAC of the raw
    body with the webhook secret). Covers a closed tab or a lost connection.
  - `mark_order_paid` returns `paid` once, then `already_paid`; a different payment on a paid
    order is `other_payment`, and a payment for a released team is `orphan`. Both of those
    show in the organizer console as "Payments to refund".
- **No SDK:** `fetch` + `node:crypto` (`timingSafeEqual`), so no new dependency.
- **Secrets:** `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server-only env vars.
  Only the key ID reaches the browser. `RAZORPAY_API_BASE` (e2e stand-in) is ignored on Vercel.
- **CSP:** `/register` alone adds `https://checkout.razorpay.com` (script), `https://api.razorpay.com`
  and `https://checkout.razorpay.com` (frame), and `https://api.razorpay.com`,
  `https://lumberjack.razorpay.com` (connect). checkout.js is added by our nonced bundle, which
  `'strict-dynamic'` allows. `/register` uses COOP `same-origin-allow-popups` so bank and UPI
  pop-ups can report back.

## Consequences

- A team is only "in" once paid. Teams saved before this change have `not_required`.
- Late payments after a hold expires need a manual refund in the Razorpay dashboard.
- The confirmation email is still a stub until the domain and Resend are set up.
- Before going live: live keys, a live webhook, KYC (activation starts Razorpay's 90-day offer),
  and Terms, Privacy, Refund and Contact pages, which Razorpay checks during KYC.
