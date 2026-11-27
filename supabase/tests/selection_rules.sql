-- Problem statement selection rules test (migrations 20261127100000 and 20261127100100). Run in
-- the Supabase SQL editor or via execute_sql, on STAGING. Everything runs in one transaction that
-- always ends with an exception, so nothing is kept. Every line of the report should start with "ok".

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

-- Registers a two-member team as the server would, and pays for it when paid is true.
create function pg_temp.make_team(label text, paid boolean) returns uuid language plpgsql as $f$
declare
  r record;
begin
  select * into r from public.register_team(jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'team_name', 'Sel ' || label, 'institution', 'CBIT',
    'leader_phone', '+919876543210', 'consent_version', 'v1',
    'members', jsonb_build_array(
      jsonb_build_object('full_name','Lead ' || label,'email','lead-' || lower(label) || '@example.com'),
      jsonb_build_object('full_name','Mate ' || label,'email','mate-' || lower(label) || '@example.com'))));
  if paid then
    perform public.record_payment_order(r.team_id, 'order_SEL' || label, 139800);
    perform public.mark_order_paid('order_SEL' || label, 'pay_SEL' || label, 139800);
  end if;
  return r.team_id;
end $f$;

do $test$
declare
  out text := '';
  run text := upper(substr(md5(random()::text), 1, 6));
  t uuid[] := '{}';
  unpaid uuid;
  ref text[] := '{}';
  code text[] := '{}';
  r record;
  n int;
  t1 timestamptz;
  i int;
begin
  -- Small slots so fallbacks are easy to see: statement 1 takes 1 team, 2 takes 1, 3 takes 2, 4 takes 0.
  update private.problem_statements set slots = case id when 1 then 1 when 2 then 1 when 3 then 2 else 0 end;
  update private.event_settings set selection_state = 'not_open', results_published = false where id;

  set local role service_role;
  -- Team 7 never submits and is never assigned.
  for i in 1..7 loop
    t := t || pg_temp.make_team(run || i, true);
  end loop;
  unpaid := pg_temp.make_team(run || 'U', false);
  reset role;

  -- Codes: one per paid team, none for unpaid teams.
  select array_agg(tm.reference order by tm.seq), array_agg(c.code order by tm.seq) into ref, code
  from unnest(t) as x(id) join public.teams tm on tm.id = x.id join private.team_codes c on c.team_id = tm.id;
  out := out || pg_temp.check(cardinality(code) = 7, 'every paid team has a code');
  out := out || pg_temp.check((select bool_and(c ~ '^[A-HJ-NP-Z2-9]{8}$') from unnest(code) c), 'codes are 8 characters without look-alikes');
  out := out || pg_temp.check(not exists (select 1 from private.team_codes where team_id = unpaid), 'unpaid team has no code');

  set local role service_role;
  -- Window not open yet.
  out := out || pg_temp.expect_err('refused before the window opens',
    format($$select public.submit_statement_choice(%L, %L, '{1,2,3,4}')$$, ref[1], code[1]), 'selection_not_open');
  reset role;
  update private.event_settings set selection_state = 'open' where id;
  set local role service_role;

  -- Bad input and bad proof.
  out := out || pg_temp.expect_err('ranking with a repeat refused', format($$select public.submit_statement_choice(%L, %L, '{1,1,2,3}')$$, ref[1], code[1]), 'invalid_ranking');
  out := out || pg_temp.expect_err('ranking of 3 refused', format($$select public.submit_statement_choice(%L, %L, '{1,2,3}')$$, ref[1], code[1]), 'invalid_ranking');
  out := out || pg_temp.expect_err('ranking with 5 refused', format($$select public.submit_statement_choice(%L, %L, '{1,2,3,5}')$$, ref[1], code[1]), 'invalid_ranking');
  out := out || pg_temp.expect_err('wrong code refused', format($$select public.submit_statement_choice(%L, 'ABCDEFGH', '{1,2,3,4}')$$, ref[1]), 'invalid_proof');
  out := out || pg_temp.expect_err('another team''s code refused', format($$select public.submit_statement_choice(%L, %L, '{1,2,3,4}')$$, ref[1], code[2]), 'invalid_proof');
  out := out || pg_temp.expect_err('unknown reference refused (same error)', format($$select public.submit_statement_choice('FF27-9999', %L, '{1,2,3,4}')$$, code[1]), 'invalid_proof');
  out := out || pg_temp.expect_err('unpaid team refused (it has no code)',
    format($$select public.submit_statement_choice((select reference from public.teams where id = %L), 'ABCDEFGH', '{1,2,3,4}')$$, unpaid), 'invalid_proof');

  -- First come, first served with fallbacks. Everyone ranks 1, 2, 3, 4.
  select * into r from public.submit_statement_choice(lower(' ' || ref[1] || ' '), lower(code[1]), '{1,2,3,4}');
  out := out || pg_temp.check(r.outcome = 'submitted', 'first team submits (reference and code trimmed, any case)');
  t1 := r.submitted_at;
  for i in 2..5 loop
    perform public.submit_statement_choice(ref[i], code[i], '{1,2,3,4}');
  end loop;
  reset role;
  out := out || pg_temp.check((select assigned_statement = 1 and assigned_choice = 1 from public.statement_choices where team_id = t[1]), 'team 1 gets its 1st choice');
  out := out || pg_temp.check((select assigned_statement = 2 and assigned_choice = 2 from public.statement_choices where team_id = t[2]), 'team 2 falls back to its 2nd choice');
  out := out || pg_temp.check((select assigned_statement = 3 and assigned_choice = 3 from public.statement_choices where team_id = t[3]), 'team 3 falls back to its 3rd choice');
  out := out || pg_temp.check((select assigned_statement = 3 from public.statement_choices where team_id = t[4]), 'team 4 takes the last slot of statement 3');
  out := out || pg_temp.check((select assigned_statement is null and ranking is not null from public.statement_choices where team_id = t[5]), 'team 5: every choice full, saved with no statement');
  out := out || pg_temp.check((select bool_and(c.n <= ps.slots) from private.problem_statements ps
      cross join lateral (select count(*) n from public.statement_choices sc where sc.assigned_statement = ps.id) c), 'no statement over its slots');
  out := out || pg_temp.check((select array_agg(team_id order by submitted_at) = t[1:5] from public.statement_choices where team_id = any (t)), 'submission times follow the order of submitting');

  set local role service_role;
  -- One entry per team.
  select * into r from public.submit_statement_choice(ref[1], code[1], '{4,3,2,1}');
  out := out || pg_temp.check(r.outcome = 'already_submitted' and r.submitted_at = t1, 'second submit returns already_submitted with the first time');
  reset role;
  out := out || pg_temp.check((select ranking = '{1,2,3,4}' and assigned_statement = 1 from public.statement_choices where team_id = t[1]), 'second submit changed nothing');
  out := out || pg_temp.expect_err('direct duplicate row refused', format($$insert into public.statement_choices (team_id, ranking, submitted_at) values (%L, '{1,2,3,4}', now())$$, t[1]), '23505');

  -- Withdrawn team refused.
  update public.teams set status = 'withdrawn' where id = t[6];
  set local role service_role;
  out := out || pg_temp.expect_err('withdrawn team refused', format($$select public.submit_statement_choice(%L, %L, '{1,2,3,4}')$$, ref[6], code[6]), 'not_eligible');
  reset role;
  update public.teams set status = 'registered' where id = t[6];

  -- Publish needs a closed window; results hidden until published.
  set local role service_role;
  select count(*) into n from public.published_results();
  out := out || pg_temp.check(n = 0, 'no results before publish');
  reset role;

  -- Organizer functions.
  insert into private.admin_allowlist (email) values ('sel-organizer@example.com');
  perform set_config('request.jwt.claims', '{"email":"sel-organizer@example.com","role":"authenticated","aal":"aal1"}', true);
  set local role authenticated;
  out := out || pg_temp.expect_err('organizer without the authenticator step refused', $$select public.set_selection_state('closed')$$, 'not_admin');
  select count(*) into n from public.statement_choices;
  out := out || pg_temp.check(n = 0, 'organizer without the authenticator step reads no entries');
  reset role;
  perform set_config('request.jwt.claims', '{"email":"sel-organizer@example.com","role":"authenticated","aal":"aal2"}', true);
  set local role authenticated;
  out := out || pg_temp.expect_err('publish refused while open', $$select public.set_results_published(true)$$, 'selection_not_closed');
  out := out || pg_temp.expect_err('hand assignment refused while open', format($$select public.assign_statement_by_hand(%L, 4::smallint)$$, ref[6]), 'selection_not_closed');
  out := out || pg_temp.expect_err('organizer cannot write a ranking', format($$insert into public.statement_choices (team_id, ranking, submitted_at) values (%L, '{1,2,3,4}', now())$$, t[6]), '42501');
  perform public.set_selection_state('closed');
  select count(*) into n from public.admin_selection_teams() x where x.team_reference = any (ref);
  out := out || pg_temp.check(n = 7, 'organizer sees all paid test teams with codes');
  out := out || pg_temp.check((select assigned = 1 and slots = 1 from public.admin_statement_slots() where statement_id = 1), 'organizer sees slots used');
  out := out || pg_temp.expect_err('hand assignment into a full statement refused', format($$select public.assign_statement_by_hand(%L, 1::smallint)$$, ref[6]), 'statement_full');
  out := out || pg_temp.expect_err('hand assignment into a 0-slot statement refused', format($$select public.assign_statement_by_hand(%L, 4::smallint)$$, ref[6]), 'statement_full');
  out := out || pg_temp.expect_err('assigned team cannot be reassigned', format($$select public.assign_statement_by_hand(%L, 3::smallint)$$, ref[1]), 'already_assigned');
  out := out || pg_temp.expect_err('direct overwrite of an assignment refused', format($$update public.statement_choices set assigned_statement = 2 where team_id = %L$$, t[1]), 'already_assigned');
  out := out || pg_temp.expect_err('unpaid team cannot be assigned', format($$select public.assign_statement_by_hand((select reference from public.teams where id = %L), 2::smallint)$$, unpaid), 'team_not_found');
  out := out || pg_temp.expect_err('organizer session cannot call submit', format($$select public.submit_statement_choice(%L, %L, '{1,2,3,4}')$$, ref[6], code[6]), '42501');
  reset role;
  update private.problem_statements set slots = 3 where id = 2;
  perform set_config('request.jwt.claims', '{"email":"sel-organizer@example.com","role":"authenticated","aal":"aal2"}', true);
  set local role authenticated;
  perform public.assign_statement_by_hand(ref[5], 2::smallint);
  perform public.assign_statement_by_hand(ref[6], 2::smallint);
  reset role;
  out := out || pg_temp.check((select assigned_statement = 2 and assigned_by = 'sel-organizer@example.com' and assigned_choice is null from public.statement_choices where team_id = t[5]), 'team with no statement assigned by hand (keeps its ranking)');
  out := out || pg_temp.check((select assigned_statement = 2 and ranking is null from public.statement_choices where team_id = t[6]), 'team that never submitted assigned by hand');

  set local role service_role;
  out := out || pg_temp.expect_err('submissions refused once closed', format($$select public.submit_statement_choice(%L, %L, '{1,2,3,4}')$$, ref[6], code[6]), 'selection_closed');
  reset role;
  perform set_config('request.jwt.claims', '{"email":"sel-organizer@example.com","role":"authenticated","aal":"aal2"}', true);
  set local role authenticated;
  perform public.set_results_published(true);
  out := out || pg_temp.expect_err('reopening refused while published', $$select public.set_selection_state('open')$$, 'results_published');
  out := out || pg_temp.expect_err('hand assignment refused once published', format($$select public.assign_statement_by_hand(%L, 3::smallint)$$, ref[7]), 'results_published');
  reset role;
  set local role service_role;
  select count(*) into n from public.published_results() p where p.team_reference = any (ref);
  out := out || pg_temp.check(n = 6, 'all six test teams in the published results');
  select * into r from public.selection_status();
  out := out || pg_temp.check(r.selection_state = 'closed' and r.results_published, 'status says closed and published');
  reset role;
  perform set_config('request.jwt.claims', '{"email":"sel-organizer@example.com","role":"authenticated","aal":"aal2"}', true);
  set local role authenticated;
  perform public.set_results_published(false);
  reset role;
  set local role service_role;
  select count(*) into n from public.published_results();
  out := out || pg_temp.check(n = 0, 'unpublish hides results again');

  -- Public roles see and call nothing.
  set local role anon;
  out := out || pg_temp.expect_err('anon cannot read entries', $$select * from public.statement_choices$$, '42501');
  out := out || pg_temp.expect_err('anon cannot submit', $$select public.submit_statement_choice('FF27-0001','ABCDEFGH','{1,2,3,4}')$$, '42501');
  out := out || pg_temp.expect_err('anon cannot read results function', $$select public.published_results()$$, '42501');
  out := out || pg_temp.expect_err('anon cannot read status', $$select public.selection_status()$$, '42501');
  out := out || pg_temp.expect_err('anon cannot open the window', $$select public.set_selection_state('open')$$, '42501');
  out := out || pg_temp.expect_err('anon cannot read team codes', $$select * from private.team_codes$$, '42501');
  reset role;
  perform set_config('request.jwt.claims', '{"email":"stranger@example.com","role":"authenticated","aal":"aal2"}', true);
  set local role authenticated;
  select count(*) into n from public.statement_choices;
  out := out || pg_temp.check(n = 0, 'signed-in non-organizer reads no entries');
  out := out || pg_temp.expect_err('non-organizer cannot open the window', $$select public.set_selection_state('open')$$, 'not_admin');
  out := out || pg_temp.expect_err('non-organizer cannot list teams', $$select public.admin_selection_teams()$$, 'not_admin');
  select count(*) into n from private.team_codes;
  out := out || pg_temp.check(n = 0, 'non-organizer reads no team codes');
  out := out || pg_temp.expect_err('non-organizer cannot submit', $$select public.submit_statement_choice('FF27-0001','ABCDEFGH','{1,2,3,4}')$$, '42501');

  reset role;
  raise exception E'REPORT\n%', out;
end $test$;
