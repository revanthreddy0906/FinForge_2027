-- STAGING ONLY. Prepares the selection burst test (loadtest/selection-burst.js): removes the
-- e2e selection teams, creates 75 paid test teams named "k6sel team N" (consecutive references),
-- and opens the selection window. Prints the first reference number for REF_START.
do $$
declare
  r record;
begin
  if exists (select 1 from public.teams where team_name like 'k6sel %') then
    raise exception 'k6sel teams already exist; run loadtest/selection-cleanup.sql first';
  end if;
  delete from public.teams where team_name like 'E2E Sel %';
  for i in 1..75 loop
    select * into r from public.register_team(jsonb_build_object(
      'idempotency_key', gen_random_uuid(), 'team_name', 'k6sel team ' || i, 'institution', 'Load Test College',
      'leader_phone', '+919876543210', 'consent_version', 'k6',
      'members', jsonb_build_array(
        jsonb_build_object('full_name', 'Load Tester One', 'email', 'k6sel-' || i || '-a@example.com'),
        jsonb_build_object('full_name', 'Load Tester Two', 'email', 'k6sel-' || i || '-b@example.com'))));
    perform public.record_payment_order(r.team_id, 'order_K6SEL' || lpad(i::text, 4, '0'), 139800);
    perform public.mark_order_paid('order_K6SEL' || lpad(i::text, 4, '0'), 'pay_K6SEL' || lpad(i::text, 4, '0'), 139800);
  end loop;
  update private.event_settings set selection_state = 'open', results_published = false where id;
end $$;

select min(seq) as ref_start, max(seq) as ref_end, count(*) as teams
from public.teams where team_name like 'k6sel %' and payment_state = 'paid';
