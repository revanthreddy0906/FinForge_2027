-- Registration fee via Razorpay. See docs/adr/0004-registration-payments.md.
--
-- Flow: register_team saves the team with payment_state 'pending' and holds its name and emails for
-- private.event_settings.payment_hold_minutes. The server creates one Razorpay order per team
-- (record_payment_order) and marks it paid only after checking Razorpay's signature and the
-- payment itself (mark_order_paid). Payment writes go through these functions, as the service
-- role only. Organizers read payments through RLS, like teams.

-- ---------------------------------------------------------------------------
-- Settings: how long an unpaid team keeps its name and emails.
-- ---------------------------------------------------------------------------
alter table private.event_settings
  add column payment_hold_minutes integer not null default 30,
  add constraint event_settings_payment_hold_range check (payment_hold_minutes between 5 and 1440);

-- ---------------------------------------------------------------------------
-- Teams: payment_state tracks the fee. New teams start 'pending'; teams saved before payments
-- existed (staging test rows) are 'not_required'. teams.status (registered/withdrawn) is unchanged.
-- ---------------------------------------------------------------------------
alter table public.teams
  add column payment_state text not null default 'not_required',
  add constraint teams_payment_state_valid check (payment_state in ('pending', 'paid', 'not_required'));
alter table public.teams alter column payment_state set default 'pending';
create index teams_payment_state_created_idx on public.teams (payment_state, created_at);

-- ---------------------------------------------------------------------------
-- payments: one Razorpay order per team.
-- team_id becomes null if an unpaid team's hold expired and its slot was released; a later
-- successful payment on that order is then an orphan the organizers must refund.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams (id) on delete set null,
  team_reference text not null,
  team_name text not null,
  member_count smallint not null,
  amount_paise integer not null,
  currency text not null default 'INR',
  razorpay_order_id text not null,
  razorpay_payment_id text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payments_order_id_format check (razorpay_order_id ~ '^order_[A-Za-z0-9]{6,40}$'),
  constraint payments_payment_id_format check (
    razorpay_payment_id is null or razorpay_payment_id ~ '^pay_[A-Za-z0-9]{6,40}$'
  ),
  constraint payments_member_count_range check (member_count between 2 and 5),
  constraint payments_amount_positive check (amount_paise >= 100),
  constraint payments_currency_inr check (currency = 'INR'),
  constraint payments_status_valid check (status in ('created', 'paid')),
  constraint payments_paid_fields check (
    (status = 'paid') = (razorpay_payment_id is not null and paid_at is not null)
  ),
  constraint payments_order_id_key unique (razorpay_order_id),
  constraint payments_payment_id_key unique (razorpay_payment_id)
);
create unique index payments_team_id_key on public.payments (team_id) where team_id is not null;
comment on table public.payments is 'Razorpay orders, one per team. Written only by the payment functions (service role).';

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant select, insert on public.payments to service_role;
grant update (status, razorpay_payment_id, paid_at) on public.payments to service_role;
grant update (payment_state) on public.teams to service_role;

create policy "Admins can read payments"
  on public.payments for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- register_team: same rules and signature as before, plus
--   * new teams start with payment_state 'pending' (column default);
--   * expired unpaid holds on the same name or emails are released first
--     (private.release_expired_holds, next migration);
--   * a name or email held by an unpaid team raises team_name_held / email_held;
--   * the team cap counts paid teams and unexpired unpaid ones.
-- ---------------------------------------------------------------------------
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
  v_emails text[];
  v_count integer;
  v_max integer;
  v_hold integer;
  v_taken record;
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

  select array_agg(lower(btrim(m ->> 'email'))) into v_emails from jsonb_array_elements(v_members) m;
  if (select count(distinct e) from unnest(v_emails) e) <> v_count then
    raise exception 'duplicate_member_email' using errcode = 'P0001';
  end if;

  perform private.release_expired_holds(v_team_name, v_emails);

  select s.max_teams, s.payment_hold_minutes into v_max, v_hold from private.event_settings s where s.id;
  if v_max is not null and (
    select count(*) from public.teams t
    where t.status = 'registered'
      and (t.payment_state <> 'pending' or t.created_at >= now() - make_interval(mins => v_hold))
  ) >= v_max then
    raise exception 'event_full' using errcode = 'P0001';
  end if;

  select t.payment_state into v_taken from public.teams t where lower(t.team_name) = lower(v_team_name);
  if found then
    if v_taken.payment_state = 'pending' then
      raise exception 'team_name_held' using errcode = 'P0001';
    end if;
    raise exception 'team_name_taken' using errcode = 'P0001';
  end if;

  select tm.email, t.payment_state into v_taken
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.email = any (v_emails)
  limit 1;
  if found then
    if v_taken.payment_state = 'pending' then
      raise exception 'email_held' using errcode = 'P0001', detail = v_taken.email;
    end if;
    raise exception 'email_taken' using errcode = 'P0001', detail = v_taken.email;
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

-- ---------------------------------------------------------------------------
-- payment_details: what the server needs to start or resume payment for a team.
-- The amount is the saved member count times the fee the server passes in from its config.
-- Error: team_not_found.
-- ---------------------------------------------------------------------------
create function public.payment_details(p_team_id uuid, p_fee_per_member_paise integer)
returns table (
  team_reference text,
  team_name text,
  payment_state text,
  leader_name text,
  leader_email text,
  leader_phone text,
  member_count integer,
  amount_paise integer,
  razorpay_order_id text,
  order_amount_paise integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_count integer;
  v_pay public.payments%rowtype;
begin
  if p_fee_per_member_paise is null or p_fee_per_member_paise < 100 then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'fee';
  end if;
  select * into v_team from public.teams t where t.id = p_team_id;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0001';
  end if;
  select count(*) into v_count from public.team_members m where m.team_id = p_team_id;
  select * into v_pay from public.payments p where p.team_id = p_team_id;
  return query select
    v_team.reference, v_team.team_name, v_team.payment_state, v_team.leader_name, v_team.leader_email,
    v_team.leader_phone, v_count, v_count * p_fee_per_member_paise,
    v_pay.razorpay_order_id, v_pay.amount_paise;
end;
$$;
revoke all on function public.payment_details(uuid, integer) from public, anon, authenticated;
grant execute on function public.payment_details(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- record_payment_order: stores the Razorpay order for a pending team. If two requests race,
-- the first order wins and both get its id back (the second Razorpay order is never used).
-- Errors: team_not_found, team_not_pending, invalid_input.
-- ---------------------------------------------------------------------------
create function public.record_payment_order(
  p_team_id uuid,
  p_razorpay_order_id text,
  p_amount_paise integer
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_count integer;
  v_order text;
begin
  select * into v_team from public.teams t where t.id = p_team_id for update;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0001';
  end if;
  if v_team.payment_state <> 'pending' then
    raise exception 'team_not_pending' using errcode = 'P0001';
  end if;

  select p.razorpay_order_id into v_order from public.payments p where p.team_id = p_team_id;
  if found then
    return v_order;
  end if;

  select count(*) into v_count from public.team_members m where m.team_id = p_team_id;
  begin
    insert into public.payments (team_id, team_reference, team_name, member_count, amount_paise, razorpay_order_id)
    values (p_team_id, v_team.reference, v_team.team_name, v_count, p_amount_paise, p_razorpay_order_id);
  exception when check_violation or unique_violation then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'order';
  end;
  return p_razorpay_order_id;
end;
$$;
revoke all on function public.record_payment_order(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_payment_order(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- mark_order_paid: called after the server has checked Razorpay's signature and fetched the
-- captured payment. Safe to call any number of times for the same payment.
-- outcome: 'paid' (just confirmed), 'already_paid' (repeat), 'orphan' (team released; refund),
--          'other_payment' (order already paid by a different payment; refund this one).
-- Errors: unknown_order, amount_mismatch.
-- ---------------------------------------------------------------------------
create function public.mark_order_paid(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise integer
)
returns table (outcome text, team_reference text, team_name text, leader_email text)
language plpgsql
set search_path = ''
as $$
declare
  v_pay public.payments%rowtype;
  v_email text;
begin
  select * into v_pay from public.payments p where p.razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    raise exception 'unknown_order' using errcode = 'P0001';
  end if;
  if v_pay.amount_paise <> p_amount_paise then
    raise exception 'amount_mismatch' using errcode = 'P0001',
      detail = format('order %s expects %s, payment is %s', v_pay.razorpay_order_id, v_pay.amount_paise, p_amount_paise);
  end if;

  select t.leader_email into v_email from public.teams t where t.id = v_pay.team_id;

  if v_pay.status = 'paid' then
    return query select
      case when v_pay.razorpay_payment_id = p_razorpay_payment_id then 'already_paid' else 'other_payment' end,
      v_pay.team_reference, v_pay.team_name, v_email;
    return;
  end if;

  begin
    update public.payments p
    set status = 'paid', razorpay_payment_id = p_razorpay_payment_id, paid_at = now()
    where p.id = v_pay.id;
  exception when check_violation or unique_violation then
    raise exception 'invalid_input' using errcode = 'P0001', detail = 'payment';
  end;

  if v_pay.team_id is null then
    return query select 'orphan', v_pay.team_reference, v_pay.team_name, null::text;
    return;
  end if;

  update public.teams t set payment_state = 'paid' where t.id = v_pay.team_id and t.payment_state = 'pending';
  return query select 'paid', v_pay.team_reference, v_pay.team_name, v_email;
end;
$$;
revoke all on function public.mark_order_paid(text, text, integer) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Admin export view: payment columns added at the end (create or replace keeps old columns).
-- ---------------------------------------------------------------------------
create or replace view public.admin_registrations
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
  m.email,
  t.payment_state,
  p.amount_paise,
  p.razorpay_payment_id,
  p.paid_at
from public.teams t
join public.team_members m on m.team_id = t.id
left join public.payments p on p.team_id = t.id;

revoke all on public.admin_registrations from anon, authenticated;
grant select on public.admin_registrations to authenticated, service_role;
