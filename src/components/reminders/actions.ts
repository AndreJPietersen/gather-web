"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail, emailSiteUrl } from "@/lib/email";
import { formatEventDate, formatZAR } from "@/lib/utils";
import { getUpcomingWindow, upcomingCutoffDate, isInstallmentOverdue, isDateOverdue } from "@/lib/upcoming";
import { getMyEventIds } from "@/lib/my-events";
import { renderEmail } from "@/lib/email/layout";
import { getSystemTemplateContent } from "@/lib/email/templates";
import { firstNameOf, REMINDER_FOOTER } from "@/lib/email/fields";

// Reminder emails are the admin-editable system templates
// (/admin/emails — payment_due_soon, payment_overdue, task_due_soon,
// task_overdue) rendered into the shared Gather layout. Every merged value
// is HTML-escaped by renderEmail; the previous inline HTML interpolated
// event, vendor and task names raw.
async function displayNameFor(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? null;
}

interface DueInstallment {
  id: string;
  due_date: string;
  amount: string;
  status: string;
  payment_plans: {
    event_vendor_id: string;
    event_vendors: {
      event_id: string;
      events: { id: string; name: string } | null;
      vendors: { name: string } | null;
    } | null;
  } | null;
}

interface DueTask {
  id: string;
  event_id: string;
  title: string;
  due_date: string;
  events: { id: string; name: string } | null;
}

// The implicitly-triggered replacement for a cron-scheduled reminder job —
// see the standing comment on payment_reminders in schema.ts for why.
// Called once per app session from <ReminderChecker> (mounted in AppShell),
// fire-and-forget from the client: nothing in the UI waits on this, and a
// failure here should never be visible to whoever happened to trigger it —
// it's someone else's payment reminder just as often as their own.
export async function checkAndSendPaymentReminders(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return;

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_reminders")
    .eq("profile_id", user.id)
    .maybeSingle();
  // No row yet means the column defaults (true) still apply — same fallback
  // Home's own Upcoming sections already use.
  if (prefs && !prefs.email_reminders) return;

  const upcomingWindow = await getUpcomingWindow(supabase, user.id);
  const cutoff = upcomingCutoffDate(upcomingWindow);

  // Owner-or-editor-collaborator only — matches payment_installments' own
  // write posture, and payment_reminders_insert_self's own RLS check, so
  // this never attempts an insert RLS would reject anyway.
  const eventIds = await getMyEventIds(supabase, user.id, "editor");
  if (eventIds.size === 0) return;

  const { data: dueInstallments } = await supabase
    .from("payment_installments")
    .select(
      "id, due_date, amount, status, payment_plans(event_vendor_id, event_vendors(event_id, events(id, name), vendors(name)))",
    )
    .eq("status", "pending")
    .lte("due_date", cutoff)
    .returns<DueInstallment[]>();

  const qualifying = (dueInstallments ?? []).filter((i) => {
    const eventId = i.payment_plans?.event_vendors?.event_id;
    return eventId && eventIds.has(eventId);
  });
  if (qualifying.length === 0) return;

  const { data: alreadyReminded } = await supabase
    .from("payment_reminders")
    .select("payment_installment_id")
    .in(
      "payment_installment_id",
      qualifying.map((i) => i.id),
    )
    .returns<{ payment_installment_id: string }[]>();
  const remindedIds = new Set((alreadyReminded ?? []).map((r) => r.payment_installment_id));

  const firstName = firstNameOf(await displayNameFor(supabase, user.id));
  for (const installment of qualifying) {
    if (remindedIds.has(installment.id)) continue;

    const eventVendor = installment.payment_plans?.event_vendors;
    const eventName = eventVendor?.events?.name ?? "your event";
    const vendorName = eventVendor?.vendors?.name ?? "your vendor";
    const overdue = isInstallmentOverdue(installment.status, installment.due_date);
    const eventId = eventVendor?.event_id;
    const paymentsUrl = eventId
      ? `${emailSiteUrl()}/events/${eventId}/payments?vendor=${installment.payment_plans?.event_vendor_id}`
      : emailSiteUrl();

    const template = await getSystemTemplateContent(overdue ? "payment_overdue" : "payment_due_soon");
    const email = renderEmail(
      template,
      {
        first_name: firstName,
        email: user.email,
        amount: formatZAR(installment.amount),
        vendor_name: vendorName,
        event_name: eventName,
        due_date: formatEventDate(installment.due_date),
        link: paymentsUrl,
      },
      { siteUrl: emailSiteUrl(), footerNote: REMINDER_FOOTER },
    );
    const { ok } = await sendEmail({ to: user.email, ...email });

    // Recorded either way, `sent` reflecting what actually happened — a
    // delivery failure shouldn't mean retrying (and re-emailing) every
    // single time this check fires for the rest of the reminder window. A
    // real delivery-monitoring/retry story is future work, not this pass's.
    await supabase.from("payment_reminders").insert({
      payment_installment_id: installment.id,
      contact_user_id: user.id,
      remind_at: new Date().toISOString(),
      method: "email",
      sent: ok,
    });
  }
}

// The task-reminder twin — same implicit-trigger shape, same email pref
// gate, same idempotency-by-recording approach, but scoped to owner-or-any-
// collaborator (not editor-only) to match event_tasks' own, broader SELECT
// policy — see the standing comment on task_reminders in schema.ts.
export async function checkAndSendTaskReminders(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return;

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_reminders")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (prefs && !prefs.email_reminders) return;

  const upcomingWindow = await getUpcomingWindow(supabase, user.id);
  const cutoff = upcomingCutoffDate(upcomingWindow);

  const eventIds = await getMyEventIds(supabase, user.id);
  if (eventIds.size === 0) return;

  const { data: dueTasks } = await supabase
    .from("event_tasks")
    .select("id, event_id, title, due_date, events(id, name)")
    .eq("completed", false)
    .not("due_date", "is", null)
    .lte("due_date", cutoff)
    .returns<DueTask[]>();

  const qualifying = (dueTasks ?? []).filter((t) => eventIds.has(t.event_id));
  if (qualifying.length === 0) return;

  const { data: alreadyReminded } = await supabase
    .from("task_reminders")
    .select("event_task_id")
    .in(
      "event_task_id",
      qualifying.map((t) => t.id),
    )
    .returns<{ event_task_id: string }[]>();
  const remindedIds = new Set((alreadyReminded ?? []).map((r) => r.event_task_id));

  const firstName = firstNameOf(await displayNameFor(supabase, user.id));
  for (const task of qualifying) {
    if (remindedIds.has(task.id)) continue;

    const eventName = task.events?.name ?? "your event";
    const overdue = isDateOverdue(task.due_date);
    const tasksUrl = `${emailSiteUrl()}/events/${task.event_id}/tasks`;

    const template = await getSystemTemplateContent(overdue ? "task_overdue" : "task_due_soon");
    const email = renderEmail(
      template,
      { first_name: firstName, email: user.email, task_title: task.title, event_name: eventName, due_date: formatEventDate(task.due_date), link: tasksUrl },
      { siteUrl: emailSiteUrl(), footerNote: REMINDER_FOOTER },
    );
    const { ok } = await sendEmail({ to: user.email, ...email });

    await supabase.from("task_reminders").insert({
      event_task_id: task.id,
      contact_user_id: user.id,
      remind_at: new Date().toISOString(),
      method: "email",
      sent: ok,
    });
  }
}
