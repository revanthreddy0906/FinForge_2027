-- event_settings and admin_allowlist never need Data API access. Move them out of the exposed
-- public schema into private, so they can't be reached through PostgREST at all.
-- (Clears the rls_enabled_no_policy advisor notes; RLS stays enabled as a second wall.)

alter table public.event_settings set schema private;
alter table public.admin_allowlist set schema private;

revoke all on private.event_settings, private.admin_allowlist from public, anon, authenticated;
grant select on private.event_settings to service_role;
grant select, insert, delete on private.admin_allowlist to service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_allowlist a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- register_team now reads the cap from private.event_settings.
create or replace function public.register_team(payload jsonb)
returns table (team_id uuid, reference text, created boolean)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_key uuid;
  v_team_name text := btrim(payload ->> 'team_name');
  v_institution text := btrim(payload ->> 'institution');
  v_phone text := btrim(payload ->> 'leader_phone');
  v_consent text := btrim(payload ->> 'consent_version');
  v_members jsonb := payload -> 'members';
  v_count integer;
  v_max integer;
  v_taken text;
  v_team public.teams%rowtype;
  v_constraint text;
begin
  begin
    v_key := (payload ->> 'idempotency_key')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'idempotency_key';
  end;
  if v_key is null then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'idempotency_key';
  end if;

  -- Serialize registrations: makes the cap and duplicate checks race-free.
  perform pg_advisory_xact_lock(hashtext('finforge.register_team'));

  -- Idempotent replay.
  select * into v_team from public.teams t where t.idempotency_key = v_key;
  if found then
    return query select v_team.id, v_team.reference, false;
    return;
  end if;

  if v_members is null or jsonb_typeof(v_members) <> 'array' then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'members';
  end if;
  v_count := jsonb_array_length(v_members);
  if v_count < 2 or v_count > 5 then
    raise exception 'invalid_team_size' using errcode = 'P0001', detail = format('%s members; allowed 2 to 5', v_count);
  end if;

  if (select count(distinct lower(btrim(m ->> 'email'))) from jsonb_array_elements(v_members) m) <> v_count then
    raise exception 'duplicate_member_email' using errcode = 'P0001';
  end if;

  select s.max_teams into v_max from private.event_settings s where s.id;
  if v_max is not null and (select count(*) from public.teams t where t.status = 'registered') >= v_max then
    raise exception 'event_full' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.teams t where lower(t.team_name) = lower(v_team_name)) then
    raise exception 'team_name_taken' using errcode = 'P0001';
  end if;

  select tm.email into v_taken
  from public.team_members tm
  where tm.email in (select lower(btrim(m ->> 'email')) from jsonb_array_elements(v_members) m)
  limit 1;
  if v_taken is not null then
    raise exception 'email_taken' using errcode = 'P0001', detail = v_taken;
  end if;

  begin
    insert into public.teams (team_name, institution, leader_name, leader_email, leader_phone, idempotency_key, consent_version)
    values (
      v_team_name,
      v_institution,
      btrim(v_members -> 0 ->> 'full_name'),
      lower(btrim(v_members -> 0 ->> 'email')),
      v_phone,
      v_key,
      v_consent
    )
    returning * into v_team;

    insert into public.team_members (team_id, position, full_name, email)
    select v_team.id, m.ord::smallint, btrim(m.value ->> 'full_name'), lower(btrim(m.value ->> 'email'))
    from jsonb_array_elements(v_members) with ordinality as m (value, ord);
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'teams_team_name_ci_key' then
        raise exception 'team_name_taken' using errcode = 'P0001';
      elsif v_constraint = 'teams_idempotency_key_key' then
        raise exception 'invalid_input' using errcode = 'P0001', detail = 'idempotency_key';
      else
        raise exception 'email_taken' using errcode = 'P0001';
      end if;
    when check_violation or not_null_violation then
      get stacked diagnostics v_constraint = constraint_name;
      raise exception 'invalid_input' using errcode = 'P0001', detail = coalesce(nullif(v_constraint, ''), 'missing field');
  end;

  return query select v_team.id, v_team.reference, true;
end;
$$;

revoke all on function public.register_team(jsonb) from public, anon, authenticated;
grant execute on function public.register_team(jsonb) to service_role;
