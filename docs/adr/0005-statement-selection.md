# ADR-0005: Event-day problem statement selection

**Status:** Accepted (2026-11-27)
**Deciders:** Revanth (FinFoundry)

## Context

On event day, teams scan a QR code that opens `/statements`. One person per team ranks the four
problem statements and submits once. Statements go out first come, first served by server time.
Only paid teams take part. Organizers open and close the window, and results go public only
after an organizer presses Publish.

Team references (`FF27-0080`) count up, so anyone can guess another team's reference, and a
wrong entry can't be undone.

## Decision

- **Identity: the registration reference only** (Revanth, 27 Nov 2026). The reference is each
  team's identity for the whole event, and teams are asked to type it carefully. A first version
  used a random team code printed at check-in. Revanth chose the reference alone to keep event day
  simple and accepted the risk below. The review step shows the reference large before the final
  submit.
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
  300 submits a minute per IP, which stops floods. A per-reference limit would let anyone lock a
  rival team out while slots fill up, so there is none. There is no Turnstile: a challenge shown
  to a whole room on one IP would slow real teams down.
- **Results show references only**, grouped by statement. No team names.
- **Reopening.** Organizers can reopen the window after closing it (while results are
  unpublished), for example if many teams couldn't submit for technical reasons. Teams that
  already have an entry, including ones assigned by hand, keep it.
- **Statement texts stay off the client.** They live in the server-only
  `src/config/problem-statements.ts` and render only while the window is open.

## Consequences

- Slots are provisional (19 each, 76 for 75 teams, so one statement ends with one team fewer).
  Change them in `private.problem_statements` and in the config together.
- Accepted risk: anyone who types another team's reference uses up that team's only entry. If it
  happens, organizers can see the exact submit time; fixing it means removing the entry in the
  database by hand.
- Known risk: one person flooding from the venue Wi-Fi could hit the per-IP limit for everyone
  there for up to a minute. The fallback is that organizers see exact submit times and can assign
  by hand; turning on per-IP keys per device would need a separate design.
- If a cache expiry is missed, the public pages can lag by up to about 15 seconds. Submissions are
  never affected.
- Staging e2e runs leave paid test teams and use up slots. Run `supabase/tests/cleanup_staging.sql`
  to remove them.
