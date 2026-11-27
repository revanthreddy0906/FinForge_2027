-- STAGING ONLY. Removes the selection load-test teams (their entries go with them) and their
-- Razorpay test payment rows, and puts the selection window back to "not open".
delete from public.payments where team_reference in (select reference from public.teams where team_name like 'k6sel %');
delete from public.teams where team_name like 'k6sel %';
update private.event_settings set selection_state = 'not_open', results_published = false where id;
select (select count(*) from public.teams where team_name like 'k6sel %') as teams_left,
       (select count(*) from public.statement_choices) as entries_left;
