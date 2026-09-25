-- Admin email: lock the tables down, seed templates, and the audience query.

-- 1. Admin-only tables — no client access at all (RLS is on with no
--    policies; this also removes the column-level default grants).
REVOKE ALL ON public.email_templates, public.admin_emails, public.admin_email_recipients, public.email_suppressions
  FROM anon, authenticated;

-- 2. System templates: the automatic reminders, reworded from the bare
--    inline HTML they used to be (src/components/reminders/actions.ts).
--    Keep in step with SYSTEM_TEMPLATE_DEFAULTS in src/lib/email/fields.ts.
INSERT INTO public.email_templates (key, name, kind, category, subject, preheader, heading, body, button_label, button_url) VALUES
  ('payment_due_soon', 'Payment due soon (automatic)', 'system', 'transactional',
   'Payment due soon: {{amount}} to {{vendor_name}}', '{{vendor_name}} — due {{due_date}}', 'A payment is coming up',
   E'Hi {{first_name}},\n\nA payment for **{{event_name}}** is due soon:\n\n- **{{vendor_name}}** — {{amount}}\n- Due {{due_date}}',
   'View this payment', '{{link}}'),
  ('payment_overdue', 'Payment overdue (automatic)', 'system', 'transactional',
   'Overdue: {{amount}} to {{vendor_name}}', '{{vendor_name}} — was due {{due_date}}', 'A payment is overdue',
   E'Hi {{first_name}},\n\nA payment for **{{event_name}}** has passed its due date:\n\n- **{{vendor_name}}** — {{amount}}\n- Was due {{due_date}}\n\nIf you''ve already paid, mark it paid on Gather so everyone stays in sync.',
   'View this payment', '{{link}}'),
  ('task_due_soon', 'Task due soon (automatic)', 'system', 'transactional',
   'Task due soon: {{task_title}}', 'For {{event_name}} — due {{due_date}}', 'A task is coming up',
   E'Hi {{first_name}},\n\n**{{task_title}}** for {{event_name}} is due {{due_date}}.',
   'View this task', '{{link}}'),
  ('task_overdue', 'Task overdue (automatic)', 'system', 'transactional',
   'Overdue: {{task_title}}', 'For {{event_name}} — was due {{due_date}}', 'A task is overdue',
   E'Hi {{first_name}},\n\n**{{task_title}}** for {{event_name}} was due {{due_date}}.',
   'View this task', '{{link}}')
ON CONFLICT (key) DO NOTHING;

-- 3. Starter custom templates, so the page isn't empty on day one.
INSERT INTO public.email_templates (name, kind, category, subject, preheader, heading, body, button_label, button_url) VALUES
  ('Welcome to Gather', 'custom', 'transactional',
   'Welcome to Gather, {{first_name}}', 'Everything for your event, in one place', 'Welcome, {{first_name}}!',
   E'We''re so glad you''re here.\n\nGather keeps everything about your event in one place:\n\n- Guests and RSVPs\n- Tasks and a budget that adds itself up\n- Vendors you can chat with and pay on a plan\n\nStart by creating your first event — it only takes a minute.',
   'Plan an event', '/events/new'),
  ('General announcement', 'custom', 'announcement',
   'News from Gather', 'What''s new this month', 'What''s new on Gather',
   E'Hi {{first_name}},\n\nHere''s what''s new:\n\n- **Something new** — a sentence about it.\n- **Something improved** — a sentence about it.\n\nThanks for planning with us.',
   'Open Gather', '/'),
  ('Vendor: your listing is live', 'custom', 'transactional',
   'Your listing is live on Gather', 'Planners can now find and book you', 'You''re live, {{first_name}}!',
   E'Your business is now verified and visible to planners on Gather.\n\nA complete profile ranks higher, so take a minute to:\n\n- Add a logo and a few gallery photos\n- List your services\n- Link your social accounts',
   'Open your dashboard', '/'),
  ('Invite a vendor to join', 'custom', 'transactional',
   'Planners are looking for you on Gather', 'List your business for free', 'Join Gather as a vendor',
   E'Hi there,\n\nPlanners on Gather are looking for vendors like you. Listing your business is free, and you''ll be able to:\n\n- Receive booking requests and chat with planners\n- Send quotes and track payments\n- Show off your work with a gallery',
   'List your business', '/register?persona=vendor');

-- 4. Who an admin send goes to. Service role only (like admin_watchlist).
--    Suspended users are always left out. SECURITY DEFINER to read
--    auth.users for email addresses. p_target_id is the business for
--    'vendor_team' and the person for 'user'; p_days is for 'new_users'.
CREATE OR REPLACE FUNCTION public.admin_email_audience(p_segment text, p_target_id uuid DEFAULT NULL, p_days int DEFAULT NULL)
RETURNS TABLE (user_id uuid, email text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, lower(u.email), p.display_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.user_suspensions s WHERE s.user_id = p.id)
    AND CASE p_segment
      WHEN 'everyone' THEN true
      WHEN 'planners' THEN NOT EXISTS (
        SELECT 1 FROM public.vendor_team_members m WHERE m.user_id = p.id AND m.is_active)
      WHEN 'vendor_owners' THEN EXISTS (
        SELECT 1 FROM public.vendor_team_members m WHERE m.user_id = p.id AND m.is_active AND m.role = 'owner')
      WHEN 'vendor_team' THEN EXISTS (
        SELECT 1 FROM public.vendor_team_members m WHERE m.user_id = p.id AND m.is_active AND m.vendor_id = p_target_id)
      WHEN 'new_users' THEN p.created_at > now() - make_interval(days => coalesce(p_days, 30))
      WHEN 'user' THEN p.id = p_target_id
      ELSE false
    END
  ORDER BY p.created_at;
$$;

REVOKE ALL ON FUNCTION public.admin_email_audience(text, uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_email_audience(text, uuid, int) TO service_role;
