-- Registration rules and access test. Run in the Supabase SQL editor or via execute_sql.
-- Everything runs in one transaction that always ends with an exception, so nothing is kept.
-- The report is the exception message: every line should start with "ok".
-- Note: identity sequences are not rolled back, so each run uses up a few team reference
-- numbers. Restart public.teams.seq before registration opens (see docs/STATUS.md).
-- Not covered here (needs an update statement): the team cap / event_full path.

create function pg_temp.expect_err(label text, sqltxt text, want text) returns text language plpgsql as $f$
begin
  execute sqltxt;
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';
  return 'FAIL ' || label || ': no error' || chr(10);
exception when others then
  if sqlerrm = want or sqlstate = want then return 'ok   ' || label || chr(10);
  else return 'FAIL ' || label || ': got ' || sqlstate || ' ' || sqlerrm || chr(10); end if;
end $f$;

do $test$
declare
  out text := '';
  r record;
  r2 record;
  k1 uuid := gen_random_uuid();
  n int;
  p text;
begin
  set local role service_role;
  select * into r from public.register_team(jsonb_build_object(
    'idempotency_key', k1, 'team_name', '  Ledger Hawks ', 'institution', 'CBIT',
    'leader_phone', '+919876543210', 'consent_version', 'v1',
    'members', jsonb_build_array(
      jsonb_build_object('full_name','Asha Rao','email',' Asha@Example.com '),
      jsonb_build_object('full_name','Vik Reddy','email','vik@example.com'),
      jsonb_build_object('full_name','Sam K','email','sam@example.com'))));
  out := out || format('%s valid registration -> %s created=%s', case when r.created then 'ok  ' else 'FAIL' end, r.reference, r.created) || chr(10);

  select * into r2 from public.register_team(jsonb_build_object(
    'idempotency_key', k1, 'team_name', 'Other', 'institution', 'X', 'leader_phone', '+919876543210', 'consent_version', 'v1', 'members', '[]'::jsonb));
  out := out || format('%s replay same key returns same team, created=%s', case when r2.team_id = r.team_id and not r2.created then 'ok  ' else 'FAIL' end, r2.created) || chr(10);

  select count(*) into n from public.team_members where team_id = r.team_id;
  select leader_email into p from public.teams where id = r.team_id;
  out := out || format('%s 3 members stored, leader email normalized (%s)', case when n = 3 and p = 'asha@example.com' then 'ok  ' else 'FAIL' end, p) || chr(10);

  set constraints all deferred;
  out := out || pg_temp.expect_err('duplicate team name (case-insensitive)', $$select public.register_team('{"idempotency_key":"00000000-0000-4000-8000-000000000001","team_name":"LEDGER hawks","institution":"CBIT","leader_phone":"+919876543211","consent_version":"v1","members":[{"full_name":"Bo Bo","email":"bo@example.com"},{"full_name":"Cy Cy","email":"cy@example.com"}]}')$$, 'team_name_taken');
  out := out || pg_temp.expect_err('member already on another team', $$select public.register_team('{"idempotency_key":"00000000-0000-4000-8000-000000000002","team_name":"Firewall","institution":"CBIT","leader_phone":"+919876543211","consent_version":"v1","members":[{"full_name":"Bo Bo","email":"bo@example.com"},{"full_name":"Vik R","email":"VIK@example.com"}]}')$$, 'email_taken');
  out := out || pg_temp.expect_err('leader already leads another team', $$select public.register_team('{"idempotency_key":"00000000-0000-4000-8000-000000000003","team_name":"Firewall","institution":"CBIT","leader_phone":"+919876543211","consent_version":"v1","members":[{"full_name":"Asha Rao","email":"asha@example.com"},{"full_name":"Cy Cy","email":"cy@example.com"}]}')$$, 'email_taken');
  out := out || pg_temp.expect_err('1 member rejected', $$select public.register_team('{"idempotency_key":"00000000-0000-4000-8000-000000000004","team_name":"Solo","institution":"CBIT","leader_phone":"+919876543211","consent_version":"v1","members":[{"full_name":"Bo Bo","email":"bo@example.com"}]}')$$, 'invalid_team_size');
  out := out || pg_temp.expect_err('6 members rejected', $$select public.register_team('{"idempotency_key":"00000000-0000-4000-8000-000000000005","team_name":"Six","institution":"CBIT","leader_phone":"+919876543211","consent_version":"v1","members":[{"full_name":"A1 a","email":"a1@x.com"},{"full_name":"A2 a","email":"a2@x.com"},{"full_name":"A3 a","email":"a3@x.com"},{"full_name":"A4 a","email":"a4@x.com"},{"full_name":"A5 a","email":"a5@x.com"},{"full_name":"A6 a","email":"a6@x.com"}]}')$$, 'invalid_team_size');
  out := out || pg_temp.expect_err('same email twice in one team', $$select public.register_team('{"idempotency_key":"00000000-0000-4000-8000-000000000006","team_name":"Twins","institution":"CBIT","leader_phone":"+919876543211","consent_version":"v1","members":[{"full_name":"Bo Bo","email":"bo@example.com"},{"full_name":"Bo Two","email":"BO@example.com"}]}')$$, 'duplicate_member_email');
  out := out || pg_temp.expect_err('bad phone number', $$select public.register_team('{"idempotency_key":"00000000-0000-4000-8000-000000000007","team_name":"Phoney","institution":"CBIT","leader_phone":"12345","consent_version":"v1","members":[{"full_name":"Bo Bo","email":"bo@example.com"},{"full_name":"Cy Cy","email":"cy@example.com"}]}')$$, 'invalid_input');
  out := out || pg_temp.expect_err('bad idempotency key', $$select public.register_team('{"idempotency_key":"nope","team_name":"Keyless","institution":"CBIT","leader_phone":"+919876543211","consent_version":"v1","members":[]}')$$, 'invalid_input');
  out := out || pg_temp.expect_err('team name too long', $$select public.register_team(jsonb_build_object('idempotency_key','00000000-0000-4000-8000-000000000008','team_name',repeat('x',61),'institution','CBIT','leader_phone','+919876543211','consent_version','v1','members','[{"full_name":"Bo Bo","email":"bo@example.com"},{"full_name":"Cy Cy","email":"cy@example.com"}]'::jsonb))$$, 'invalid_input');

  reset role;
  out := out || pg_temp.expect_err('direct insert of 1-member team blocked by DB trigger', $$with t as (insert into public.teams (team_name,institution,leader_name,leader_email,leader_phone,idempotency_key,consent_version) values ('Direct','CBIT','Bo Bo','bo@example.com','+919876543211',gen_random_uuid(),'v1') returning id) insert into public.team_members (team_id,position,full_name,email) select id,1,'Bo Bo','bo@example.com' from t$$, 'invalid_team_size');

  set local role anon;
  out := out || pg_temp.expect_err('anon cannot read teams', 'select * from public.teams', '42501');
  out := out || pg_temp.expect_err('anon cannot read admin view', 'select * from public.admin_registrations', '42501');
  out := out || pg_temp.expect_err('anon cannot insert contact messages', $$insert into public.contact_messages (name,email,message) values ('Spam Bot','x@y.com','hello there world')$$, '42501');
  out := out || pg_temp.expect_err('anon cannot call register_team', $$select public.register_team('{}')$$, '42501');
  reset role;

  perform set_config('request.jwt.claims', '{"email":"stranger@example.com","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.admin_registrations;
  out := out || format('%s non-admin signed-in user sees %s rows', case when n = 0 then 'ok  ' else 'FAIL' end, n) || chr(10);
  out := out || pg_temp.expect_err('signed-in user cannot insert team', $$insert into public.teams (team_name,institution,leader_name,leader_email,leader_phone,idempotency_key,consent_version) values ('X Team','CBIT','Bo Bo','bo@example.com','+919876543211',gen_random_uuid(),'v1')$$, '42501');
  out := out || pg_temp.expect_err('signed-in user cannot call register_team', $$select public.register_team('{}')$$, '42501');
  reset role;

  insert into private.admin_allowlist (email) values ('organizer@example.com');
  perform set_config('request.jwt.claims', '{"email":"Organizer@Example.com","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.admin_registrations;
  out := out || format('%s allow-listed admin sees %s member rows in export view', case when n = 3 then 'ok  ' else 'FAIL' end, n) || chr(10);
  reset role;

  out := out || format('%s no API role has write privileges on teams/members (insert/update/delete)', case when not exists (
    select 1 from unnest(array['anon','authenticated']) ro, unnest(array['public.teams','public.team_members']) tb, unnest(array['INSERT','UPDATE','DELETE']) pv
    where has_table_privilege(ro, tb, pv)) then 'ok  ' else 'FAIL' end) || chr(10);
  out := out || format('%s private settings tables not readable by API roles', case when not has_table_privilege('anon','private.event_settings','SELECT') and not has_table_privilege('authenticated','private.admin_allowlist','SELECT') then 'ok  ' else 'FAIL' end) || chr(10);

  raise exception E'TEST REPORT (rolled back)\n%', out;
end $test$;
