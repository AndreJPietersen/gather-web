-- Follow-up to 00000000000008: that migration's `revoke select (is_admin)
-- on public.profiles from authenticated, anon` executed without error but
-- had NO actual effect — verified directly against
-- information_schema.column_privileges after running it. This is a genuine
-- Postgres privilege-model subtlety, not a typo: a column-level REVOKE
-- cannot carve a column out of a broader TABLE-level grant (the
-- `grant all on all tables in schema public to anon, authenticated,
-- service_role` from 00000000000003) — the table-level grant still covers
-- every column regardless. The only way to actually restrict a column is
-- the reverse order: revoke the table-level SELECT entirely, then grant
-- SELECT back only on the specific columns that should be readable.
--
-- id/display_name/phone/created_at are the only columns anon/authenticated
-- ever legitimately need to read directly (matches every existing
-- `.from("profiles").select(...)` call site in the app) — is_admin is
-- deliberately excluded, closing the direct-PostgREST-read hole that
-- 00000000000008's ineffective column revoke was meant to close.

revoke select on public.profiles from authenticated, anon;
grant select (id, display_name, phone, created_at) on public.profiles to authenticated, anon;
