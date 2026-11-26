-- Make the deny-all intent on private tables explicit. Only the service role (which bypasses RLS)
-- and security-definer functions owned by postgres read these tables.
create policy "No API access to event settings"
  on private.event_settings as restrictive for all to anon, authenticated
  using (false) with check (false);

create policy "No API access to admin allowlist"
  on private.admin_allowlist as restrictive for all to anon, authenticated
  using (false) with check (false);
