-- Organizer selection functions run as the signed-in organizer (security invoker), not as the
-- function owner. Row Level Security is the gate, as for the rest of the console
-- (ADR-0003): every table they touch allows organizers only, through private.is_admin().
-- Clears Supabase lint 0029 (security definer functions callable by signed-in users).
-- The rules for hand assignment live in a trigger, so they also hold for direct table writes.

-- ---------------------------------------------------------------------------
-- Organizer access to the private tables (private is not exposed through the Data API, so these
-- are reachable only from inside the functions below).
-- ---------------------------------------------------------------------------
drop policy "No API access to event settings" on private.event_settings;
create policy "No anon access to event settings"
  on private.event_settings as restrictive for all to anon
  using (false) with check (false);
create policy "Organizers only for event settings"
  on private.event_settings as restrictive for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Organizers can read event settings"
  on private.event_settings for select to authenticated
  using ((select private.is_admin()));
create policy "Organizers can update event settings"
  on private.event_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on private.event_settings to authenticated;
grant update (selection_state, results_published, updated_at) on private.event_settings to authenticated;

drop policy "No API access to problem statements" on private.problem_statements;
create policy "No anon access to problem statements"
  on private.problem_statements as restrictive for all to anon
  using (false) with check (false);
create policy "Organizers can read problem statements"
  on private.problem_statements for select to authenticated
  using ((select private.is_admin()));
grant select on private.problem_statements to authenticated;

drop policy "No API access to team codes" on private.team_codes;
create policy "No anon access to team codes"
  on private.team_codes as restrictive for all to anon
  using (false) with check (false);
create policy "Organizers can read team codes"
  on private.team_codes for select to authenticated
  using ((select private.is_admin()));
grant select on private.team_codes to authenticated;

-- Organizers may only fill in an assignment; they can never write a ranking or submission time.
grant insert (team_id, assigned_statement, assigned_by, assigned_at) on public.statement_choices to authenticated;
grant update (assigned_statement, assigned_by, assigned_at) on public.statement_choices to authenticated;
create policy "Admins can assign statements"
  on public.statement_choices for insert to authenticated
  with check ((select private.is_admin()));
create policy "Admins can fill in an assignment"
  on public.statement_choices for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Rules for every write to statement_choices:
--   * a statement never gets more teams than its slots;
--   * a submission (ranking, time) is never changed, and an assignment is never changed once set;
--   * a hand assignment (assigned_by set) needs the window closed and results unpublished, and
--     records the organizer's own email.
-- Security definer so the slot count sees every row whoever writes.
-- ---------------------------------------------------------------------------
create function private.check_statement_choice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slots smallint;
  v_taken integer;
  v_settings private.event_settings%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.team_id <> old.team_id
       or new.ranking is distinct from old.ranking
       or new.submitted_at is distinct from old.submitted_at
       or new.assigned_choice is distinct from old.assigned_choice then
      raise exception 'entry_locked' using errcode = 'P0001';
    end if;
    if old.assigned_statement is not null then
      raise exception 'already_assigned' using errcode = 'P0001';
    end if;
  end if;

  if new.assigned_by is not null then
    select * into v_settings from private.event_settings s where s.id;
    if v_settings.selection_state <> 'closed' then
      raise exception 'selection_not_closed' using errcode = 'P0001';
    end if;
    if v_settings.results_published then
      raise exception 'results_published' using errcode = 'P0001';
    end if;
    if new.assigned_by <> lower(coalesce(auth.jwt() ->> 'email', '')) then
      raise exception 'invalid_input' using errcode = 'P0001', detail = 'assigned_by';
    end if;
  end if;

  if new.assigned_statement is not null then
    select ps.slots into v_slots from private.problem_statements ps where ps.id = new.assigned_statement;
    select count(*) into v_taken from public.statement_choices sc
    where sc.assigned_statement = new.assigned_statement and sc.team_id <> new.team_id;
    if v_taken >= v_slots then
      raise exception 'statement_full' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.check_statement_choice() from public, anon, authenticated;

create trigger statement_choices_check
  before insert or update on public.statement_choices
  for each row execute function private.check_statement_choice();

-- ---------------------------------------------------------------------------
-- Organizer functions, now security invoker.
-- ---------------------------------------------------------------------------
create or replace function public.admin_selection_settings()
returns table (selection_state text, results_published boolean)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query select s.selection_state, s.results_published from private.event_settings s where s.id;
end;
$$;

create or replace function public.admin_statement_slots()
returns table (statement_id smallint, slots smallint, assigned integer)
language plpgsql
stable
security invoker
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

create or replace function public.admin_selection_teams()
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
security invoker
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

create or replace function public.set_selection_state(p_state text)
returns void
language plpgsql
security invoker
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

create or replace function public.set_results_published(p_published boolean)
returns void
language plpgsql
security invoker
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

-- Errors: team_not_found, already_assigned, invalid_input, statement_full, selection_not_closed,
-- results_published (the last four from the trigger).
create or replace function public.assign_statement_by_hand(p_reference text, p_statement smallint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_existing public.statement_choices%rowtype;
  v_by text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  perform private.require_admin();
  perform pg_advisory_xact_lock(hashtext('finforge.statement_choice'));

  select t.id into v_team_id from public.teams t
  where t.reference = upper(btrim(coalesce(p_reference, '')))
    and t.payment_state = 'paid' and t.status = 'registered';
  if not found then
    raise exception 'team_not_found' using errcode = 'P0001';
  end if;
  if p_statement is null or not exists (select 1 from private.problem_statements ps where ps.id = p_statement) then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'statement';
  end if;

  select * into v_existing from public.statement_choices sc where sc.team_id = v_team_id;
  if found then
    if v_existing.assigned_statement is not null then
      raise exception 'already_assigned' using errcode = 'P0001';
    end if;
    update public.statement_choices sc
    set assigned_statement = p_statement, assigned_by = v_by, assigned_at = now()
    where sc.team_id = v_team_id;
  else
    insert into public.statement_choices (team_id, assigned_statement, assigned_by, assigned_at)
    values (v_team_id, p_statement, v_by, now());
  end if;
end;
$$;
