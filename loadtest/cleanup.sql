-- Removes every row a k6 load test created. STAGING ONLY (project ref iylwxuxotglsshkaoayx).
-- Test teams are named "k6lt ..." and use k6lt-...@example.com emails. Members are removed by
-- the team_members foreign key (on delete cascade); payments rows keep a copy of the team name,
-- so they are deleted by name. Razorpay TEST orders can't be deleted; they stay in test mode.
begin;

delete from public.payments where team_name like 'k6lt%';
delete from public.teams where team_name like 'k6lt%';

-- Must be 0, 0, 0 before committing.
select
  (select count(*) from public.teams where team_name like 'k6lt%') as teams_left,
  (select count(*) from public.team_members where email like 'k6lt-%@example.com') as members_left,
  (select count(*) from public.payments where team_name like 'k6lt%') as payments_left;

commit;
