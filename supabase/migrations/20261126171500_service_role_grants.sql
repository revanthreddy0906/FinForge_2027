-- This project does not auto-grant Data API privileges on new public tables, so the server's
-- service role had no access to the registration tables. Grant only what the server needs:
-- register_team inserts teams/members, the contact route inserts messages, and the server reads
-- them for confirmation emails. No delete or truncate.
grant select, insert on public.teams, public.team_members to service_role;
grant select, insert, update on public.contact_messages to service_role;
grant select on public.admin_registrations to service_role;
grant usage on all sequences in schema public to service_role;
