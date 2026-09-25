-- Security hardening after an attack review (docs/gather_web_architecture.md,
-- 2026-09-24 "Security review"). Every issue below was reproduced first by
-- calling Supabase's public API as an ordinary user or anonymous visitor.
--
-- Root cause for most of them: RLS decides WHICH ROWS a user may insert or
-- update, never WHICH COLUMNS. Supabase grants anon/authenticated privileges
-- on every column by default, so e.g. "you may update your own profile" also
-- meant "you may set your own is_admin". Fix: per-column privileges — revoke
-- the table-level INSERT/UPDATE and grant back only the columns the app
-- actually writes (checked against every user-client write in src/).
-- Service-role code (admin console, onboarding owner insert, guest RSVP) is
-- unaffected: service_role keeps full privileges.

-- ---------------------------------------------------------------------------
-- 1. Anonymous visitors never write anything through the API (guest RSVP
--    goes through a Server Action using the service role). And TRUNCATE is
--    not governed by RLS at all, so nobody but the service role gets it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t.tablename);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', t.tablename);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM authenticated;

-- Admin-only tables: no client access at all (belt and braces on top of
-- "RLS on, no policies").
REVOKE ALL ON public.admin_audit_log, public.admin_watchlist_dismissals, public.user_suspensions,
  public.vendor_feature_placements, public.support_case_comments, public.user_write_log, public.write_rate_limits
  FROM anon, authenticated;
-- Public read-only lookup/settings tables: select only.
REVOKE INSERT, UPDATE, DELETE ON public.app_settings, public.feature_prices, public.event_types,
  public.service_categories, public.event_type_service_categories FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2. profiles — "promote yourself to admin" and "anyone can read everyone's
--    phone number". Readable columns are now only id / display_name /
--    created_at; is_admin is read only through the is_admin() function, and
--    a user's own phone is read server-side (profile edit page).
-- ---------------------------------------------------------------------------
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, created_at) ON public.profiles TO anon, authenticated;
GRANT UPDATE (display_name, phone) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. vendors — "create a listing that is already verified", and owners
--    un-hiding a listing an admin hid or self-verifying.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.vendors FROM authenticated;
GRANT INSERT (name, primary_category, description, phone, website, created_by) ON public.vendors TO authenticated;
GRANT UPDATE (name, primary_category, description, phone, website, logo_path) ON public.vendors TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Invites — "invited as staff, promote the invite to owner" and "invited
--    as viewer, promote yourself to editor". The invitee may only answer.
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON public.vendor_team_invites FROM authenticated;
GRANT UPDATE (status) ON public.vendor_team_invites TO authenticated;
REVOKE UPDATE ON public.event_collaborators FROM authenticated;
GRANT UPDATE (status) ON public.event_collaborators TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Bookings — "vendor moves a booking onto another planner's event".
--    Which event and vendor a booking links is fixed once created.
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON public.event_vendors FROM authenticated;
GRANT UPDATE (status, vendor_type, notes, confirmed, amount) ON public.event_vendors TO authenticated;
REVOKE UPDATE ON public.vendor_quotes FROM authenticated;
GRANT UPDATE (status) ON public.vendor_quotes TO authenticated;
REVOKE UPDATE ON public.payment_plans FROM authenticated;
GRANT UPDATE (total_amount, deposit_amount, deposit_due_date, status, notes, budget_item_id) ON public.payment_plans TO authenticated;
REVOKE UPDATE ON public.payment_installments FROM authenticated;
GRANT UPDATE (installment_number, due_date, amount, status, paid_on, payment_gateway, gateway_transaction_id, gateway_status, proof_of_payment_path)
  ON public.payment_installments TO authenticated;
REVOKE UPDATE ON public.vendor_review_replies FROM authenticated;
GRANT UPDATE (reply_text, updated_at) ON public.vendor_review_replies TO authenticated;

-- events: an editor must never be able to take ownership.
REVOKE UPDATE ON public.events FROM authenticated;
GRANT UPDATE (name, event_type, status, visibility, start_at, end_at, location, description, capacity, cover_image_url,
  updated_at, event_type_id, budget_total, budget_warning_percent, rsvp_date) ON public.events TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Requests users file — "claim already approved", "support case already
--    resolved/urgent". Only the fields the forms send; status and review
--    fields take their defaults.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.vendor_claim_requests FROM authenticated;
GRANT INSERT (vendor_id, notes, created_by) ON public.vendor_claim_requests TO authenticated;
REVOKE INSERT, UPDATE ON public.support_cases FROM authenticated;
GRANT INSERT (subject, description, category, attachment_path, requester_id, created_by) ON public.support_cases TO authenticated;
REVOKE INSERT, UPDATE ON public.vendor_business_requests FROM authenticated;
GRANT INSERT (requester_id, business_name, primary_category, needs_extra_slot, needs_duplicate_category, reason)
  ON public.vendor_business_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Email enumeration: invite_email_matches_current_user(email, user_id)
--    was callable by anyone with any user id, answering "is this person's
--    email X?". It now only ever answers for the caller themselves — every
--    policy already passes auth.uid().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_email_matches_current_user(p_invited_email text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select p_user_id = auth.uid() and exists (
    select 1 from auth.users where id = p_user_id and lower(email) = lower(p_invited_email)
  );
$function$;
