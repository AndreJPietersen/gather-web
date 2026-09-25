"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";
import { emailSiteUrl, sendEmail, sendEmailBatch } from "@/lib/email";
import { renderEmail } from "@/lib/email/layout";
import { firstNameOf, sampleVars } from "@/lib/email/fields";
import { unsubscribeUrl } from "@/lib/email/unsubscribe";
import { getMaxEmailRecipients } from "@/lib/app-settings";
import { audienceFromForm, contentFromForm, describeAudience, type Audience } from "./content-schema";

export interface EmailActionState {
  error?: string;
  message?: string;
}

async function adminEmailAddress(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function saveTemplate(_prev: EmailActionState, formData: FormData): Promise<EmailActionState> {
  const { userId } = await requireAdmin();
  const id = z.string().uuid().optional().or(z.literal("")).parse(formData.get("templateId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the template a name." };
  const { content, error } = contentFromForm(formData);
  if (!content) return { error };

  const service = createServiceClient();
  const values = {
    category: content.category,
    subject: content.subject,
    preheader: content.preheader,
    heading: content.heading,
    body: content.body,
    button_label: content.buttonLabel,
    button_url: content.buttonUrl,
    use_raw_html: content.useRawHtml,
    raw_html: content.rawHtml,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  let savedId = id || null;
  if (savedId) {
    const { data: existing } = await service.from("email_templates").select("kind").eq("id", savedId).maybeSingle();
    if (!existing) return { error: "That template no longer exists." };
    // System templates (the automatic reminders) keep their name and are
    // always transactional — only their wording changes.
    const update = existing.kind === "system" ? { ...values, category: "transactional" as const } : { ...values, name };
    const { error: updateError } = await service.from("email_templates").update(update).eq("id", savedId);
    if (updateError) return { error: "Couldn't save the template." };
  } else {
    const { data, error: insertError } = await service
      .from("email_templates")
      .insert({ ...values, name, kind: "custom" })
      .select("id")
      .single();
    if (insertError || !data) return { error: "Couldn't create the template." };
    savedId = data.id;
  }

  await logAdminAction({
    adminId: userId,
    action: id ? "email_template.updated" : "email_template.created",
    targetTable: "email_templates",
    targetId: savedId,
    detail: { name },
  });
  revalidatePath("/admin/emails");
  if (!id) redirect(`/admin/emails/templates/${savedId}?saved=1`);
  revalidatePath(`/admin/emails/templates/${savedId}`);
  return { message: "Saved." };
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("templateId"));
  if (!id.success) return;
  const service = createServiceClient();
  // Only custom templates; the automatic reminders' templates stay.
  const { data } = await service.from("email_templates").delete().eq("id", id.data).eq("kind", "custom").select("id, name");
  if (data && data.length > 0) {
    await logAdminAction({ adminId: userId, action: "email_template.deleted", targetTable: "email_templates", targetId: id.data, detail: { name: data[0].name } });
  }
  revalidatePath("/admin/emails");
  redirect("/admin/emails");
}

export async function duplicateTemplate(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("templateId"));
  if (!id.success) return;
  const service = createServiceClient();
  const { data: t } = await service.from("email_templates").select("*").eq("id", id.data).maybeSingle();
  if (!t) return;
  const { data: copy } = await service
    .from("email_templates")
    .insert({
      name: `${t.name} (copy)`.replace(" (automatic) (copy)", " (copy)"),
      kind: "custom",
      category: t.category,
      subject: t.subject,
      preheader: t.preheader,
      heading: t.heading,
      body: t.body,
      button_label: t.button_label,
      button_url: t.button_url,
      use_raw_html: t.use_raw_html,
      raw_html: t.raw_html,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (!copy) return;
  await logAdminAction({ adminId: userId, action: "email_template.duplicated", targetTable: "email_templates", targetId: copy.id, detail: { from: id.data } });
  revalidatePath("/admin/emails");
  redirect(`/admin/emails/templates/${copy.id}`);
}

// Sends whatever is currently in the editor (saved or not) to the admin's
// own address, filled with sample values — "does this look right?".
export async function sendTestEmail(_prev: EmailActionState, formData: FormData): Promise<EmailActionState> {
  const { userId } = await requireAdmin();
  const { content, error } = contentFromForm(formData);
  if (!content) return { error };
  const to = await adminEmailAddress(userId);
  if (!to) return { error: "Your account has no email address." };
  const templateKey = String(formData.get("templateKey") ?? "") || null;
  const site = emailSiteUrl();
  const rendered = renderEmail(content, { ...sampleVars(templateKey), email: to }, {
    siteUrl: site,
    unsubscribeUrl: unsubscribeUrl(site, to),
    footerNote: "This is a test email from the Gather admin console.",
  });
  const result = await sendEmail({ to, ...rendered, subject: `[Test] ${rendered.subject}` });
  return result.ok ? { message: `Test sent to ${to}.` } : { error: `Couldn't send: ${result.error}` };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

interface Recipient {
  userId: string | null;
  email: string;
  name: string | null;
}

async function resolveAudience(a: Audience): Promise<Recipient[]> {
  const service = createServiceClient();
  if (a.type === "addresses") {
    // Personalise typed addresses that belong to existing users.
    const { data: everyone } = await service.rpc("admin_email_audience", { p_segment: "everyone" });
    const known = new Map(((everyone ?? []) as { user_id: string; email: string; display_name: string | null }[]).map((u) => [u.email, u]));
    return a.emails.map((email) => {
      const u = known.get(email);
      return { userId: u?.user_id ?? null, email, name: u?.display_name ?? null };
    });
  }
  const args =
    a.type === "user"
      ? { p_segment: "user", p_target_id: a.userId }
      : { p_segment: a.segment, p_target_id: a.vendorId ?? null, p_days: a.days ?? null };
  const { data } = await service.rpc("admin_email_audience", args);
  return ((data ?? []) as { user_id: string; email: string; display_name: string | null }[]).map((u) => ({
    userId: u.user_id,
    email: u.email,
    name: u.display_name,
  }));
}

export interface AudiencePreview {
  error?: string;
  count?: number;
  sampleName?: string | null;
  sampleEmail?: string;
  suppressed?: number;
}

// "Check recipients": how many, and who the preview is personalised for.
export async function previewAudience(_prev: AudiencePreview, formData: FormData): Promise<AudiencePreview> {
  await requireAdmin();
  const { audience, error } = audienceFromForm(formData);
  if (!audience) return { error };
  const recipients = await resolveAudience(audience);
  if (recipients.length === 0) return { error: "Nobody matches that — no one would receive this email." };
  const service = createServiceClient();
  const { data: suppressed } = await service
    .from("email_suppressions")
    .select("email")
    .in("email", recipients.map((r) => r.email).slice(0, 1000));
  return {
    count: recipients.length,
    sampleName: recipients[0].name,
    sampleEmail: recipients[0].email,
    suppressed: suppressed?.length ?? 0,
  };
}

export async function sendAdminEmail(_prev: EmailActionState, formData: FormData): Promise<EmailActionState> {
  const { userId } = await requireAdmin();
  const { content, error: contentError } = contentFromForm(formData);
  if (!content) return { error: contentError };
  const { audience, error: audienceError } = audienceFromForm(formData);
  if (!audience) return { error: audienceError };

  const recipients = await resolveAudience(audience);
  if (recipients.length === 0) return { error: "Nobody matches that — no one would receive this email." };
  const max = await getMaxEmailRecipients();
  if (recipients.length > max) {
    return { error: `That's ${recipients.length} people, over the ${max}-recipient limit per send. Narrow the group, or raise the limit in Settings.` };
  }
  if (recipients.length > 1 && String(formData.get("confirm") ?? "").trim().toUpperCase() !== "SEND") {
    return { error: `This goes to ${recipients.length} people — type SEND to confirm.` };
  }

  const service = createServiceClient();
  // Announcements respect unsubscribes; transactional mail doesn't.
  let suppressed = new Set<string>();
  if (content.category === "announcement") {
    const { data } = await service.from("email_suppressions").select("email").in("email", recipients.map((r) => r.email));
    suppressed = new Set((data ?? []).map((s) => s.email));
  }

  const site = emailSiteUrl();
  const templateId = z.string().uuid().safeParse(formData.get("templateId"));
  const toSend = recipients.filter((r) => !suppressed.has(r.email));
  const messages = toSend.map((r) => ({
    to: r.email,
    ...renderEmail(
      content,
      { first_name: firstNameOf(r.name), name: r.name ?? "", email: r.email },
      {
        siteUrl: site,
        unsubscribeUrl: unsubscribeUrl(site, r.email),
        footerNote:
          content.category === "announcement"
            ? "You're receiving Gather news because you have a Gather account."
            : r.userId
              ? "You're receiving this because you have a Gather account."
              : null,
      },
    ),
  }));
  const results = await sendEmailBatch(messages);
  const sentCount = results.filter((r) => r.ok).length;

  const { data: record } = await service
    .from("admin_emails")
    .insert({
      template_id: templateId.success ? templateId.data : null,
      subject: messages[0]?.subject ?? content.subject,
      category: content.category,
      audience: { ...audience, label: describeAudience(audience) },
      recipient_count: recipients.length,
      sent_count: sentCount,
      failed_count: results.length - sentCount,
      skipped_count: suppressed.size,
      sent_by: userId,
    })
    .select("id")
    .single();
  if (record) {
    const rows = [
      ...toSend.map((r, i) => ({
        email_id: record.id,
        email: r.email,
        user_id: r.userId,
        status: results[i].ok ? ("sent" as const) : ("failed" as const),
        error: results[i].ok ? null : (results[i].error ?? null),
      })),
      ...recipients
        .filter((r) => suppressed.has(r.email))
        .map((r) => ({ email_id: record.id, email: r.email, user_id: r.userId, status: "skipped_unsubscribed" as const, error: null })),
    ];
    for (let i = 0; i < rows.length; i += 500) await service.from("admin_email_recipients").insert(rows.slice(i, i + 500));
    await logAdminAction({
      adminId: userId,
      action: "admin_email.sent",
      targetTable: "admin_emails",
      targetId: record.id,
      detail: { audience: describeAudience(audience), recipients: recipients.length, sent: sentCount },
    });
  }
  revalidatePath("/admin/emails");
  if (record) redirect(`/admin/emails/sent/${record.id}`);
  return { message: `Sent to ${sentCount} of ${recipients.length}.` };
}
