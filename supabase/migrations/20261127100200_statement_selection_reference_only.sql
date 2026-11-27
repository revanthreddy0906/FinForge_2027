-- Revanth's decision (27 Nov 2026): teams identify themselves on the selection form with their
-- registration reference only, which is their identity throughout the event. No team codes.
-- Results show only references, grouped by statement. See docs/adr/0005-statement-selection.md.

-- ---------------------------------------------------------------------------
-- Team codes go.
-- ---------------------------------------------------------------------------
drop trigger teams_paid_code on public.teams;
drop function private.team_paid_code();
drop function private.ensure_team_code(uuid);
drop function private.new_team_code();

drop function public.admin_selection_teams();
drop table private.team_codes;

-- ---------------------------------------------------------------------------
-- submit_statement_choice: reference and ranking only. Service role only.
-- outcome 'submitted' or 'already_submitted' (submitted_at is the original time, or null if the
-- team was assigned by hand).
-- Errors (P0001): invalid_ranking, selection_not_open, selection_closed, team_not_found
-- (no such reference), not_eligible (not paid, or withdrawn).
-- ---------------------------------------------------------------------------
drop function public.submit_statement_choice(text, text, smallint[]);

create function public.submit_statement_choice(p_reference text, p_ranking smallint[])
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

  select t.* into v_team from public.teams t where t.reference = upper(btrim(coalesce(p_reference, '')));
  if not found then
    raise exception 'team_not_found' using errcode = 'P0001';
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
revoke all on function public.submit_statement_choice(text, smallint[]) from public, anon, authenticated;
grant execute on function public.submit_statement_choice(text, smallint[]) to service_role;

-- ---------------------------------------------------------------------------
-- published_results: references only, once published. Service role only.
-- ---------------------------------------------------------------------------
drop function public.published_results();

create function public.published_results()
returns table (team_reference text, statement_id smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select t.reference, sc.assigned_statement
  from public.statement_choices sc
  join public.teams t on t.id = sc.team_id
  where sc.assigned_statement is not null
    and (select s.results_published from private.event_settings s where s.id)
  order by sc.assigned_statement, t.reference;
$$;
revoke all on function public.published_results() from public, anon, authenticated;
grant execute on function public.published_results() to service_role;

-- ---------------------------------------------------------------------------
-- admin_selection_teams: every paid, registered team with its entry (if any). No codes.
-- ---------------------------------------------------------------------------
create function public.admin_selection_teams()
returns table (
  team_reference text,
  team_name text,
  leader_name text,
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
    select t.reference, t.team_name, t.leader_name,
      sc.ranking, sc.submitted_at, sc.assigned_statement, sc.assigned_choice, sc.assigned_by
    from public.teams t
    left join public.statement_choices sc on sc.team_id = t.id
    where t.payment_state = 'paid' and t.status = 'registered'
    order by t.reference;
end;
$$;
revoke all on function public.admin_selection_teams() from public, anon;
grant execute on function public.admin_selection_teams() to authenticated;
