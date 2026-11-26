-- STAGING ONLY (FinForge_2027_staging). Removes teams created by the Playwright flow tests
-- (e2e/register-flow.spec.ts). Run in the SQL editor of the staging project, never production.
delete from public.teams
where team_name like 'E2E Hawks %' or team_name like 'Fresh %';
