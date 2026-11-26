-- Registration database for FinForge 2027. See docs/adr/0001-registration-database.md.
--
-- Access model:
--   * anon and authenticated get no write access to any table and cannot call register_team.
--     All writes go through our server (Zod + Turnstile + rate limit) using the service role.
--   * Allow-listed organizers (authenticated) can read registrations and contact messages,
--     and mark contact messages handled. Nobody can read through the public anon key.
--   * RLS is enabled on every table as a second wall.

-- ---------------------------------------------------------------------------
-- Default privileges: new objects in public are not exposed to API roles unless granted.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Private schema: not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- event_settings: single row of DB-enforced event rules.
-- ---------------------------------------------------------------------------
create table public.event_settings (
  id boolean primary key default true,
  max_teams integer, -- null means no cap. TODO: team cap (Revanth will confirm)
  updated_at timestamptz not null default now(),
  constraint event_settings_single_row check (id),
  constraint event_settings_max_teams_positive check (max_teams is null or max_teams > 0)
);
comment on table public.event_settings is 'Single row. max_teams null = no team cap.';
insert into public.event_settings (id, max_teams) values (true, null);

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  reference text generated always as ('FF27-' || lpad(seq::text, 4, '0')) stored unique,
  team_name text not null,
  institution text not null,
  leader_name text not null,
  leader_email text not null,
  leader_phone text not null,
  idempotency_key uuid not null,
  status text not null default 'registered',
  consent_version text not null,
  created_at timestamptz not null default now(),
  constraint teams_team_name_length check (team_name = btrim(team_name) and char_length(team_name) between 2 and 60),
  constraint teams_institution_length check (institution = btrim(institution) and char_length(institution) between 2 and 120),
  constraint teams_leader_name_length check (leader_name = btrim(leader_name) and char_length(leader_name) between 2 and 80),
  constraint teams_leader_email_format check (
    leader_email = lower(btrim(leader_email))
    and char_length(leader_email) <= 254
    and leader_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint teams_leader_phone_format check (leader_phone ~ '^\+91[6-9][0-9]{9}$'),
  constraint teams_status_valid check (status in ('registered', 'withdrawn')),
  constraint teams_consent_version_length check (char_length(consent_version) between 1 and 32),
  constraint teams_leader_email_key unique (leader_email),
  constraint teams_idempotency_key_key unique (idempotency_key)
);
create unique index teams_team_name_ci_key on public.teams (lower(team_name));
comment on table public.teams is 'One row per registered team. Written only by register_team (service role).';

-- ---------------------------------------------------------------------------
-- team_members (leader is position 1)
-- ---------------------------------------------------------------------------
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  position smallint not null,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint team_members_position_range check (position between 1 and 5),
  constraint team_members_full_name_length check (full_name = btrim(full_name) and char_length(full_name) between 2 and 80),
  constraint team_members_email_format check (
    email = lower(btrim(email))
    and char_length(email) <= 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint team_members_team_position_key unique (team_id, position),
  -- One team per person.
  constraint team_members_email_key unique (email)
);
comment on table public.team_members is 'Members of each team, 2 to 5 per team, leader at position 1.';

-- Team size 2..5 and leader consistency, checked at commit so a team is never saved half-built.
create function private.check_team_composition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_count integer;
  v_leader public.team_members%rowtype;
  v_team public.teams%rowtype;
begin
  if tg_table_name = 'teams' then
    v_team_id := new.id;
  elsif tg_op = 'DELETE' then
    v_team_id := old.team_id;
  else
    v_team_id := new.team_id;
  end if;

  select * into v_team from public.teams where id = v_team_id;
  if not found then
    return null; -- team deleted, members cascade
  end if;

  select count(*) into v_count from public.team_members where team_id = v_team_id;
  if v_count < 2 or v_count > 5 then
    raise exception 'invalid_team_size'
      using errcode = 'P0001', detail = format('team %s has %s members; allowed 2 to 5', v_team.reference, v_count);
  end if;

  select * into v_leader from public.team_members where team_id = v_team_id and position = 1;
  if not found or v_leader.email <> v_team.leader_email or v_leader.full_name <> v_team.leader_name then
    raise exception 'invalid_team_leader'
      using errcode = 'P0001', detail = 'member at position 1 must match the team leader';
  end if;

  return null;
end;
$$;

create constraint trigger teams_check_composition
  after insert or update on public.teams
  deferrable initially deferred
  for each row execute function private.check_team_composition();

create constraint trigger team_members_check_composition
  after insert or update or delete on public.team_members
  deferrable initially deferred
  for each row execute function private.check_team_composition();

-- ---------------------------------------------------------------------------
-- contact_messages
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contact_messages_name_length check (name = btrim(name) and char_length(name) between 2 and 80),
  constraint contact_messages_email_format check (
    email = lower(btrim(email))
    and char_length(email) <= 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint contact_messages_message_length check (char_length(btrim(message)) between 10 and 2000)
);
comment on table public.contact_messages is 'Contact form backup. Inserted by the server only.';

-- ---------------------------------------------------------------------------
-- admin_allowlist (values inserted by hand, never committed)
-- ---------------------------------------------------------------------------
create table public.admin_allowlist (
  email text primary key,
  added_at timestamptz not null default now(),
  constraint admin_allowlist_email_format check (email = lower(btrim(email)) and char_length(email) <= 254)
);
comment on table public.admin_allowlist is 'Organizer emails allowed into /admin.';

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.event_settings enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.contact_messages enable row level security;
alter table public.admin_allowlist enable row level security;

revoke all on public.event_settings, public.teams, public.team_members, public.contact_messages, public.admin_allowlist
  from anon, authenticated;

grant select on public.teams, public.team_members, public.contact_messages to authenticated;
grant update (handled_at) on public.contact_messages to authenticated;

create policy "Admins can read teams"
  on public.teams for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can read team members"
  on public.team_members for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can read contact messages"
  on public.contact_messages for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can mark contact messages handled"
  on public.contact_messages for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- event_settings and admin_allowlist: no policies, so only the service role can touch them.

-- ---------------------------------------------------------------------------
-- Admin export view (obeys the caller's RLS)
-- ---------------------------------------------------------------------------
create view public.admin_registrations
with (security_invoker = true)
as
select
  t.reference,
  t.team_name,
  t.institution,
  t.status,
  t.leader_phone,
  t.created_at as registered_at,
  m.position,
  m.position = 1 as is_leader,
  m.full_name,
  m.email
from public.teams t
join public.team_members m on m.team_id = t.id;

revoke all on public.admin_registrations from anon, authenticated;
grant select on public.admin_registrations to authenticated;

-- ---------------------------------------------------------------------------
-- register_team: the only write path for registrations (service role only).
--
-- payload: {
--   "idempotency_key": uuid, "team_name": text, "institution": text,
--   "leader_phone": "+91XXXXXXXXXX", "consent_version": text,
--   "members": [{ "full_name": text, "email": text }, ...]   -- first entry is the leader
-- }
-- Returns (team_id, reference, created). created = false means the idempotency key was replayed.
-- Error messages (errcode P0001): invalid_input, invalid_team_size, duplicate_member_email,
--   team_name_taken, email_taken, event_full.
-- ---------------------------------------------------------------------------
create function public.register_team(payload jsonb)
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

  select s.max_teams into v_max from public.event_settings s where s.id;
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
