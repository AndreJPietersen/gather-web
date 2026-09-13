-- Defensive/documentation only: a fresh `supabase start` already grants
-- anon/authenticated/service_role the standard baseline privileges on the
-- public schema. This file exists because, during initial development, a
-- `DROP SCHEMA public CASCADE` (used to get a clean slate while debugging
-- RLS policies) wiped those baseline grants out along with everything else
-- in the schema — RLS policies only ever RESTRICT further, they can't grant
-- access a role doesn't already have at the table-privilege level, so this
-- silently turned into "permission denied for table events" until these
-- were restored. Lesson: never DROP SCHEMA public on a Supabase-managed
-- Postgres instance — use `supabase db reset` for a genuine clean slate,
-- which reruns Supabase's own initialization (grants included) plus
-- everything under this migrations folder.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
