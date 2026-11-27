# ADR-0005: Event-day problem statement selection

**Status:** Accepted (2026-11-27)
**Deciders:** Revanth (FinFoundry)

## Context

On event day, teams scan a QR code that opens `/statements`. One person per team ranks the four
problem statements and submits once. Statements go out first come, first served by server time.
Only paid teams take part. Organizers open and close the window, and results go public only
after an organizer presses Publish.

Team references (`FF27-0080`) count up, so anyone can guess another team's reference. A wrong
entry can't be undone. Confirmation email is still off because there is no sending domain, so
a secret can't be sent by email.

## Decision

- **Proof: reference plus a team code.** Each team gets a random 8-character code when it is
  marked paid (`private.team_codes`, 32 symbols with no 0/O/1/I, 40 bits). Organizers download the
  codes from the console and print them on check-in slips. A wrong reference and a wrong code give
  the same error, so the form never confirms that a reference exists.
- **One entry per team, in the database.** `public.statement_choices` uses the team as its
  primary key, and no role can update a submission. Repeating a submit returns
  `already_submitted` with the original time.
- **Assignment at submit time.** `submit_statement_choice` takes an advisory lock, stamps
  `clock_timestamp()` (the moment it won the lock, not when the request started), and stores the
  first ranked statement that still has a slot. If every choice is full, the entry is saved with
  no statement and organizers assign it by hand.
- **Organizer controls.** These are security-invoker functions called with the organizer's own
  session. RLS and `private.is_admin()` (allow-list plus the authenticator step) decide access, as
  in ADR-0003. A trigger enforces the rules for hand assignment for every write:
  - the window must be closed and results unpublished;
  - a statement can't go over its slots;
  - an assignment can't be changed;
  - the organizer's own email is recorded.

  Publishing is allowed only while the window is closed.

- **No database reads per page view.** The status and the published results come from
  `'use cache: remote'` functions with tags. Organizer actions expire the tags with `updateTag`,
  and a 15-second lifetime is the safety net. Submissions always check the database.
- **Rate limits.** The venue Wi-Fi can put every team behind one public IP, so the only limit is
  300 submits a minute per IP, which stops floods. There is no per-reference limit: references
  are guessable, and such a limit would let anyone lock a rival team out while slots fill up.
  Guessing a code (32^8, about 10^12) at 300 tries a minute is not practical. There is no
  Turnstile either: the team code already blocks bots, and a challenge shown to a whole room on
  one IP would slow real teams down.
- **Statement texts stay off the client.** They live in the server-only
  `src/config/problem-statements.ts` and render only while the window is open.

## Consequences

- Slots are provisional (19 each). Change them in `private.problem_statements` and in the config
  together.
- Known risk: one person flooding from the venue Wi-Fi could hit the per-IP limit for everyone
  there for up to a minute. The fallback is that organizers see exact submit times and can assign
  by hand; turning on per-IP keys per device would need a separate design.
- Teams need their check-in slip. A team that lost it gets its code again from the console.
- If a cache expiry is missed, the public pages can lag by up to about 15 seconds. Submissions are
  never affected.
- Staging e2e runs leave paid test teams and use up slots. Run `supabase/tests/cleanup_staging.sql`
  to remove them.
