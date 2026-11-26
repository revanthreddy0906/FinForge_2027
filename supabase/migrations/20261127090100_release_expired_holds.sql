-- Part of the registration payments change (docs/adr/0004-registration-payments.md).
-- Kept in its own migration because it removes rows.

-- ---------------------------------------------------------------------------
-- Release expired holds that block a new registration (team name or any member email).
-- Security definer because the service role has no delete privilege on teams.
-- Never releases a team with a paid order.
-- ---------------------------------------------------------------------------
create function private.release_expired_holds(p_team_name text, p_emails text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.teams t
  where t.payment_state = 'pending'
    and t.created_at < now() - make_interval(
      mins => (select s.payment_hold_minutes from private.event_settings s where s.id)
    )
    and not exists (
      select 1 from public.payments p where p.team_id = t.id and p.status = 'paid'
    )
    and (
      lower(t.team_name) = lower(p_team_name)
      or exists (select 1 from public.team_members m where m.team_id = t.id and m.email = any (p_emails))
    );
$$;
revoke all on function private.release_expired_holds(text, text[]) from public, anon, authenticated;
grant execute on function private.release_expired_holds(text, text[]) to service_role;
