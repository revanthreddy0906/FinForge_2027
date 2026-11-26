-- Payment rules test (migrations 20261127090000 and 20261127090100). Run in the Supabase SQL
-- editor or via execute_sql, on STAGING. Everything runs in one transaction that always ends with
-- an exception, so nothing is kept. Every line of the report should start with "ok".
-- (Written without update/delete statements so the Supabase connector runs it without a prompt.)

create function pg_temp.expect_err(label text, sqltxt text, want text) returns text language plpgsql as $f$
begin
  execute sqltxt;
  return 'FAIL ' || label || ': no error' || chr(10);
exception when others then
  if sqlerrm = want or sqlstate = want then return 'ok   ' || label || chr(10);
  else return 'FAIL ' || label || ': got ' || sqlstate || ' ' || sqlerrm || chr(10); end if;
end $f$;

create function pg_temp.check(ok boolean, label text) returns text language sql as $f$
  select case when ok then 'ok   ' else 'FAIL ' end || label || chr(10);
$f$;

do $test$
declare
  out text := '';
  r record;
  d record;
  m record;
  n int;
  old_id uuid;
  k1 uuid := gen_random_uuid();
  run text := substr(md5(random()::text), 1, 8);
begin
  set local role service_role;

  -- A new team starts unpaid.
  select * into r from public.register_team(jsonb_build_object(
    'idempotency_key', k1, 'team_name', 'Pay Hawks ' || run, 'institution', 'CBIT',
    'leader_phone', '+919876543210', 'consent_version', 'v1',
    'members', jsonb_build_array(
      jsonb_build_object('full_name','Asha Rao','email','asha-' || run || '@example.com'),
      jsonb_build_object('full_name','Vik Reddy','email','vik-' || run || '@example.com'),
      jsonb_build_object('full_name','Sam K','email','sam-' || run || '@example.com'))));
  select * into d from public.payment_details(r.team_id, 69900);
  out := out || pg_temp.check(d.payment_state = 'pending', 'new team is pending payment');
  out := out || pg_temp.check(d.member_count = 3 and d.amount_paise = 209700, format('amount = 3 x 69900 = %s', d.amount_paise));
  out := out || pg_temp.check(d.razorpay_order_id is null, 'no order yet');
  out := out || pg_temp.expect_err('fee below 100 paise rejected', format($$select public.payment_details(%L, 50)$$, r.team_id), 'invalid_input');
  out := out || pg_temp.expect_err('unknown team', $$select public.payment_details(gen_random_uuid(), 69900)$$, 'team_not_found');

  -- Held name and emails while unpaid.
  out := out || pg_temp.expect_err('name held by unpaid team', format($$select public.register_team(jsonb_build_object('idempotency_key', gen_random_uuid(), 'team_name', %L, 'institution','CBIT','leader_phone','+919876543211','consent_version','v1','members','[{"full_name":"Bo Bo","email":"bo-x@example.com"},{"full_name":"Cy Cy","email":"cy-x@example.com"}]'::jsonb))$$, upper('Pay Hawks ' || run)), 'team_name_held');
  out := out || pg_temp.expect_err('email held by unpaid team', format($$select public.register_team(jsonb_build_object('idempotency_key', gen_random_uuid(), 'team_name', %L, 'institution','CBIT','leader_phone','+919876543211','consent_version','v1','members',jsonb_build_array(jsonb_build_object('full_name','Bo Bo','email','bo-y@example.com'),jsonb_build_object('full_name','Vik R','email',%L))))$$, 'Other ' || run, 'VIK-' || run || '@example.com'), 'email_held');

  -- Orders.
  out := out || pg_temp.check(public.record_payment_order(r.team_id, 'order_TEST' || run, 209700) = 'order_TEST' || run, 'order recorded');
  out := out || pg_temp.check(public.record_payment_order(r.team_id, 'order_SECOND' || run, 209700) = 'order_TEST' || run, 'second order for same team returns the first');
  out := out || pg_temp.expect_err('order for unknown team rejected', $$select public.record_payment_order(gen_random_uuid(), 'order_X00000000', 100)$$, 'team_not_found');
  select * into d from public.payment_details(r.team_id, 69900);
  out := out || pg_temp.check(d.razorpay_order_id = 'order_TEST' || run and d.order_amount_paise = 209700, 'payment_details shows the order');

  -- Paying.
  out := out || pg_temp.expect_err('wrong amount rejected', format($$select public.mark_order_paid(%L, 'pay_TEST%s', 100)$$, 'order_TEST' || run, run), 'amount_mismatch');
  out := out || pg_temp.expect_err('unknown order', $$select public.mark_order_paid('order_NOPE000000', 'pay_TEST000000', 209700)$$, 'unknown_order');
  select * into m from public.mark_order_paid('order_TEST' || run, 'pay_TEST' || run, 209700);
  out := out || pg_temp.check(m.outcome = 'paid' and m.team_reference = r.reference, format('first confirmation -> %s', m.outcome));
  select * into m from public.mark_order_paid('order_TEST' || run, 'pay_TEST' || run, 209700);
  out := out || pg_temp.check(m.outcome = 'already_paid', format('repeat (webhook after verify) -> %s', m.outcome));
  select * into m from public.mark_order_paid('order_TEST' || run, 'pay_OTHER' || run, 209700);
  out := out || pg_temp.check(m.outcome = 'other_payment', format('different payment on a paid order -> %s', m.outcome));
  select * into d from public.payment_details(r.team_id, 69900);
  out := out || pg_temp.check(d.payment_state = 'paid', 'team is paid');
  out := out || pg_temp.expect_err('no new order once paid', format($$select public.record_payment_order(%L, 'order_LATE000000', 209700)$$, r.team_id), 'team_not_pending');
  out := out || pg_temp.expect_err('name of a paid team is taken (not held)', format($$select public.register_team(jsonb_build_object('idempotency_key', gen_random_uuid(), 'team_name', %L, 'institution','CBIT','leader_phone','+919876543211','consent_version','v1','members','[{"full_name":"Bo Bo","email":"bo-z@example.com"},{"full_name":"Cy Cy","email":"cy-z@example.com"}]'::jsonb))$$, 'Pay Hawks ' || run), 'team_name_taken');

  -- Expired hold: an unpaid team created an hour ago is released by a new registration.
  reset role;
  insert into public.teams (team_name, institution, leader_name, leader_email, leader_phone, idempotency_key, consent_version, created_at)
  values ('Stale ' || run, 'CBIT', 'Old Lead', 'old-' || run || '@example.com', '+919876543212', gen_random_uuid(), 'v1', now() - interval '1 hour')
  returning id into old_id;
  insert into public.team_members (team_id, position, full_name, email) values
    (old_id, 1, 'Old Lead', 'old-' || run || '@example.com'),
    (old_id, 2, 'Old Mate', 'mate-' || run || '@example.com');
  insert into public.payments (team_id, team_reference, team_name, member_count, amount_paise, razorpay_order_id)
  select old_id, reference, team_name, 2, 139800, 'order_STALE' || run from public.teams where id = old_id;
  set local role service_role;
  select * into r from public.register_team(jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'team_name', 'Fresh ' || run, 'institution', 'CBIT',
    'leader_phone', '+919876543213', 'consent_version', 'v1',
    'members', jsonb_build_array(
      jsonb_build_object('full_name','New Lead','email','new-' || run || '@example.com'),
      jsonb_build_object('full_name','Old Mate','email','MATE-' || run || '@example.com'))));
  out := out || pg_temp.check(r.created, 'expired unpaid hold released, email reused');
  select count(*) into n from public.teams where id = old_id;
  out := out || pg_temp.check(n = 0, 'stale team removed');
  select * into m from public.mark_order_paid('order_STALE' || run, 'pay_STALE' || run, 139800);
  out := out || pg_temp.check(m.outcome = 'orphan', format('late payment on released team -> %s (refund)', m.outcome));

  -- Access: the public roles see nothing and can call nothing.
  set local role anon;
  out := out || pg_temp.expect_err('anon cannot read payments', $$select * from public.payments$$, '42501');
  out := out || pg_temp.expect_err('anon cannot mark paid', $$select public.mark_order_paid('order_TEST000000','pay_TEST000000',100)$$, '42501');
  out := out || pg_temp.expect_err('anon cannot record orders', $$select public.record_payment_order(gen_random_uuid(),'order_TEST000000',100)$$, '42501');
  out := out || pg_temp.expect_err('anon cannot read payment details', $$select public.payment_details(gen_random_uuid(),69900)$$, '42501');
  out := out || pg_temp.expect_err('anon cannot release holds', $$select private.release_expired_holds('x', array['x'])$$, '42501');
  set local role authenticated;
  select count(*) into n from public.payments;
  out := out || pg_temp.check(n = 0, 'signed-in non-organizer sees no payments');
  out := out || pg_temp.expect_err('authenticated cannot mark paid', $$select public.mark_order_paid('order_TEST000000','pay_TEST000000',100)$$, '42501');

  reset role;
  raise exception E'REPORT\n%', out;
end $test$;
