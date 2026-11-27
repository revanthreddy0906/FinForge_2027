-- Event-day problem statement selection. See docs/adr/0005-statement-selection.md.
--
-- Each paid team gets a random team code (printed at check-in). On event day one person per team
-- enters the reference and code, ranks the four problem statements, and submits once. The database
-- assigns statements first come, first served by its own clock: the 1st choice if a slot is left,
-- else the 2nd, and so on. Results are public only after an organizer publishes them.
--
-- Access model, as before: the public server calls the submit and read functions with the service
-- role; organizers call the admin functions with their own session (private.is_admin(), which
-- requires the authenticator-app step). Nobody can read or write these tables through the anon key.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
alter table private.event_settings
  add column selection_state text not null default 'not_open',
  add column results_published boolean not null default false,
  add constraint event_settings_selection_state_valid
    check (selection_state in ('not_open', 'open', 'closed')),
  add constraint event_settings_publish_only_when_closed
    check (not results_published or selection_state = 'closed');

-- TODO: slots per statement. Provisional 19 each; organizers confirm the limits later.
-- Mirrored in src/config/event.ts (problemStatements.slots).
create table private.problem_statements (
  id smallint primary key,
  slots smallint not null,
  constraint problem_statements_id_range check (id between 1 and 4),
  constraint problem_statements_slots_range check (slots between 0 and 500)
);
comment on table private.problem_statements is 'The four problem statements and how many teams each takes. Texts live in src/config/event.ts.';
insert into private.problem_statements (id, slots) values (1, 19), (2, 19), (3, 19), (4, 19);

alter table private.problem_statements enable row level security;
revoke all on private.problem_statements from public, anon, authenticated;
grant select on private.problem_statements to service_role;
create policy "No API access to problem statements"
  on private.problem_statements as restrictive for all to anon, authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Team codes: one random 8-character code per paid team.
-- Alphabet: A-Z and 2-9 without I, O, 0, 1 (32 symbols, 40 bits). 256 is a multiple of 32, so
-- taking each random byte modulo 32 is unbiased.
-- ---------------------------------------------------------------------------
create table private.team_codes (
  team_id uuid primary key references public.teams (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  constraint team_codes_format check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  constraint team_codes_code_key unique (code)
);
comment on table private.team_codes is 'Secret code per paid team, handed out at check-in. Proves the team on the selection form.';

alter table private.team_codes enable row level security;
revoke all on private.team_codes from public, anon, authenticated;
create policy "No API access to team codes"
  on private.team_codes as restrictive for all to anon, authenticated
  using (false) with check (false);

create function private.new_team_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;
revoke all on function private.new_team_code() from public, anon, authenticated;

-- Gives a team its code. Retries on the (very unlikely) chance of a duplicate code.
create function private.ensure_team_code(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  for attempt in 1..5 loop
    begin
      insert into private.team_codes (team_id, code)
      values (p_team_id, private.new_team_code())
      on conflict (team_id) do nothing;
      return;
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;
revoke all on function private.ensure_team_code(uuid) from public, anon, authenticated;

-- A team gets its code the moment it is marked paid.
create function private.team_paid_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_state = 'paid' then
    perform private.ensure_team_code(new.id);
  end if;
  return null;
end;
$$;
revoke all on function private.team_paid_code() from public, anon, authenticated;

create trigger teams_paid_code
  after insert or update of payment_state on public.teams
  for each row execute function private.team_paid_code();

-- Teams already paid before this migration.
select private.ensure_team_code(t.id) from public.teams t where t.payment_state = 'paid';

-- ---------------------------------------------------------------------------
-- statement_choices: one row per team (the primary key is the team).
--   * A team's own submission has ranking + submitted_at, and assigned_choice says which of its
--     choices it got (1..4), or null when every ranked statement was full.
--   * A team assigned by hand (it never submitted, or got nothing) has assigned_by set.
-- No update or delete grants: entries can't be edited. Only assign_statement_by_hand fills in an
-- empty assignment, through its own security-definer function.
-- ---------------------------------------------------------------------------
create table public.statement_choices (
  team_id uuid primary key references public.teams (id) on delete cascade,
  ranking smallint[],
  submitted_at timestamptz,
  assigned_statement smallint references private.problem_statements (id),
  assigned_choice smallint,
  assigned_by text,
  assigned_at timestamptz,
  constraint statement_choices_ranking_valid check (
    ranking is null
    or (array_ndims(ranking) = 1 and cardinality(ranking) = 4 and ranking @> array[1, 2, 3, 4]::smallint[])
  ),
  constraint statement_choices_submission_fields check ((ranking is null) = (submitted_at is null)),
  constraint statement_choices_choice_range check (assigned_choice is null or assigned_choice between 1 and 4),
  constraint statement_choices_choice_matches check (
    assigned_choice is null
    or (ranking is not null and assigned_statement = ranking[assigned_choice])
  ),
  constraint statement_choices_assignment_fields check (
    (assigned_statement is null) = (assigned_at is null)
    and (assigned_by is null or (assigned_statement is not null and assigned_choice is null))
    and (assigned_statement is null or assigned_choice is not null or assigned_by is not null)
  )
);
create index statement_choices_assigned_idx on public.statement_choices (assigned_statement);
comment on table public.statement_choices is 'Problem statement choice and assignment per team. Written only by the selection functions.';

alter table public.statement_choices enable row level security;
revoke all on public.statement_choices from anon, authenticated;
grant select on public.statement_choices to authenticated;
create policy "Admins can read statement choices"
  on public.statement_choices for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- selection_status: what the public pages need. Service role only.
-- ---------------------------------------------------------------------------
create function public.selection_status()
returns table (selection_state text, results_published boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.selection_state, s.results_published from private.event_settings s where s.id;
$$;
revoke all on function public.selection_status() from public, anon, authenticated;
grant execute on function public.selection_status() to service_role;

-- ---------------------------------------------------------------------------
-- submit_statement_choice: the only way a team submits. Service role only.
-- outcome 'submitted' (just saved) or 'already_submitted' (an entry exists; submitted_at is the
-- original time, or null if the team was assigned by hand).
-- Errors (P0001): invalid_ranking, selection_not_open, selection_closed, invalid_proof, not_eligible.
-- ---------------------------------------------------------------------------
create function public.submit_statement_choice(p_reference text, p_code text, p_ranking smallint[])
returns table (outcome text, submitted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_state text;
  v_team public.teams%rowtype;
  v_existing public.statement_choices%rowtype;
  v_statement smallint;
  v_choice smallint;
  v_now timestamptz;
begin
  if p_ranking is null or array_ndims(p_ranking) <> 1 or cardinality(p_ranking) <> 4
     or not (p_ranking @> array[1, 2, 3, 4]::smallint[]) then
    raise exception 'invalid_ranking' using errcode = 'P0001';
  end if;

  -- Serialize submissions: first come, first served is the order the lock is won.
  perform pg_advisory_xact_lock(hashtext('finforge.statement_choice'));

  select s.selection_state into v_state from private.event_settings s where s.id;
  if v_state = 'not_open' then
    raise exception 'selection_not_open' using errcode = 'P0001';
  elsif v_state <> 'open' then
    raise exception 'selection_closed' using errcode = 'P0001';
  end if;

  -- Wrong reference and wrong code give the same error.
  select t.* into v_team
  from public.teams t
  join private.team_codes c on c.team_id = t.id
  where t.reference = upper(btrim(coalesce(p_reference, '')))
    and c.code = upper(btrim(coalesce(p_code, '')));
  if not found then
    raise exception 'invalid_proof' using errcode = 'P0001';
  end if;
  if v_team.payment_state <> 'paid' or v_team.status <> 'registered' then
    raise exception 'not_eligible' using errcode = 'P0001';
  end if;

  select * into v_existing from public.statement_choices sc where sc.team_id = v_team.id;
  if found then
    return query select 'already_submitted'::text, v_existing.submitted_at;
    return;
  end if;

  for i in 1..4 loop
    if (select count(*) from public.statement_choices sc where sc.assigned_statement = p_ranking[i])
       < (select ps.slots from private.problem_statements ps where ps.id = p_ranking[i]) then
      v_statement := p_ranking[i];
      v_choice := i;
      exit;
    end if;
  end loop;

  -- clock_timestamp(), not now(): now() is when the request's transaction began, which can be
  -- earlier than when it won the lock.
  v_now := clock_timestamp();
  insert into public.statement_choices (team_id, ranking, submitted_at, assigned_statement, assigned_choice, assigned_at)
  values (v_team.id, p_ranking, v_now, v_statement, v_choice, case when v_statement is null then null else v_now end);

  return query select 'submitted'::text, v_now;
end;
$$;
revoke all on function public.submit_statement_choice(text, text, smallint[]) from public, anon, authenticated;
grant execute on function public.submit_statement_choice(text, text, smallint[]) to service_role;

-- ---------------------------------------------------------------------------
-- published_results: every assigned team, only once results are published. Service role only.
-- ---------------------------------------------------------------------------
create function public.published_results()
returns table (team_reference text, team_name text, statement_id smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select t.reference, t.team_name, sc.assigned_statement
  from public.statement_choices sc
  join public.teams t on t.id = sc.team_id
  where sc.assigned_statement is not null
    and (select s.results_published from private.event_settings s where s.id)
  order by sc.assigned_statement, t.reference;
$$;
revoke all on function public.published_results() from public, anon, authenticated;
grant execute on function public.published_results() to service_role;

-- ---------------------------------------------------------------------------
-- Organizer functions: callable with an organizer's own session; each checks private.is_admin()
-- (allow-listed email and the authenticator-app step). Error for everyone else: not_admin.
-- ---------------------------------------------------------------------------
create function private.require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function private.require_admin() from public, anon;
grant execute on function private.require_admin() to authenticated;

create function public.admin_selection_settings()
returns table (selection_state text, results_published boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query select s.selection_state, s.results_published from private.event_settings s where s.id;
end;
$$;

create function public.admin_statement_slots()
returns table (statement_id smallint, slots smallint, assigned integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select ps.id, ps.slots,
      (select count(*)::integer from public.statement_choices sc where sc.assigned_statement = ps.id)
    from private.problem_statements ps
    order by ps.id;
end;
$$;

-- Every paid, registered team with its code and its entry (if any).
create function public.admin_selection_teams()
returns table (
  team_reference text,
  team_name text,
  leader_name text,
  team_code text,
  ranking smallint[],
  submitted_at timestamptz,
  assigned_statement smallint,
  assigned_choice smallint,
  assigned_by text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select t.reference, t.team_name, t.leader_name, c.code,
      sc.ranking, sc.submitted_at, sc.assigned_statement, sc.assigned_choice, sc.assigned_by
    from public.teams t
    join private.team_codes c on c.team_id = t.id
    left join public.statement_choices sc on sc.team_id = t.id
    where t.payment_state = 'paid' and t.status = 'registered'
    order by t.reference;
end;
$$;

-- Errors: invalid_input, results_published (unpublish before closing or reopening).
create function public.set_selection_state(p_state text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_state is null or p_state not in ('not_open', 'open', 'closed') then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'state';
  end if;
  if p_state <> 'closed' and (select s.results_published from private.event_settings s where s.id) then
    raise exception 'results_published' using errcode = 'P0001';
  end if;
  update private.event_settings s set selection_state = p_state, updated_at = now() where s.id;
end;
$$;

-- Errors: selection_not_closed (publish only once the window is closed).
create function public.set_results_published(p_published boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_published and (select s.selection_state from private.event_settings s where s.id) <> 'closed' then
    raise exception 'selection_not_closed' using errcode = 'P0001';
  end if;
  update private.event_settings s set results_published = coalesce(p_published, false), updated_at = now() where s.id;
end;
$$;

-- For a paid team with no statement yet (never submitted, or every choice was full).
-- Never changes an assignment. Errors: selection_not_closed, results_published, team_not_found,
-- already_assigned, invalid_input, statement_full.
create function public.assign_statement_by_hand(p_reference text, p_statement smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_existing public.statement_choices%rowtype;
  v_slots smallint;
  v_by text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  perform private.require_admin();
  perform pg_advisory_xact_lock(hashtext('finforge.statement_choice'));

  if (select s.selection_state from private.event_settings s where s.id) <> 'closed' then
    raise exception 'selection_not_closed' using errcode = 'P0001';
  end if;
  if (select s.results_published from private.event_settings s where s.id) then
    raise exception 'results_published' using errcode = 'P0001';
  end if;

  select * into v_team from public.teams t
  where t.reference = upper(btrim(coalesce(p_reference, '')))
    and t.payment_state = 'paid' and t.status = 'registered';
  if not found then
    raise exception 'team_not_found' using errcode = 'P0001';
  end if;

  select ps.slots into v_slots from private.problem_statements ps where ps.id = p_statement;
  if not found then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'statement';
  end if;
  if (select count(*) from public.statement_choices sc where sc.assigned_statement = p_statement) >= v_slots then
    raise exception 'statement_full' using errcode = 'P0001';
  end if;

  select * into v_existing from public.statement_choices sc where sc.team_id = v_team.id;
  if found then
    if v_existing.assigned_statement is not null then
      raise exception 'already_assigned' using errcode = 'P0001';
    end if;
    update public.statement_choices sc
    set assigned_statement = p_statement, assigned_by = v_by, assigned_at = now()
    where sc.team_id = v_team.id;
  else
    insert into public.statement_choices (team_id, assigned_statement, assigned_by, assigned_at)
    values (v_team.id, p_statement, v_by, now());
  end if;
end;
$$;

revoke all on function public.admin_selection_settings() from public, anon;
revoke all on function public.admin_statement_slots() from public, anon;
revoke all on function public.admin_selection_teams() from public, anon;
revoke all on function public.set_selection_state(text) from public, anon;
revoke all on function public.set_results_published(boolean) from public, anon;
revoke all on function public.assign_statement_by_hand(text, smallint) from public, anon;
grant execute on function public.admin_selection_settings() to authenticated;
grant execute on function public.admin_statement_slots() to authenticated;
grant execute on function public.admin_selection_teams() to authenticated;
grant execute on function public.set_selection_state(text) to authenticated;
grant execute on function public.set_results_published(boolean) to authenticated;
grant execute on function public.assign_statement_by_hand(text, smallint) to authenticated;
