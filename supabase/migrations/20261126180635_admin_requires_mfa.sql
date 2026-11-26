-- Admin access now needs the authenticator-app step (Supabase MFA, aal2), not just an
-- allow-listed email. A stolen password alone (aal1 session) sees no registration data.
-- Every admin RLS policy calls private.is_admin(), so this one change covers all of them.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from private.admin_allowlist a
      where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Lets the admin page tell "not an organizer" apart from "no teams yet".
-- Security invoker: it only reports what private.is_admin() says for the caller's own token.
create function public.current_user_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;
revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated, service_role;
