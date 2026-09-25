import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { emailSiteUrl } from "@/lib/email";
import { listTemplates, rowToContent } from "@/lib/email/templates";
import { getMaxEmailRecipients } from "@/lib/app-settings";
import { SendEmailForm } from "./send-form";

// Compose and send: pick a template (edit it for this send if you like),
// choose who gets it, check the recipients, test, send.
export default async function SendEmailPage({ searchParams }: PageProps<"/admin/emails/send">) {
  await requireAdmin();
  const { templateId, userId, vendorId } = await searchParams;
  const service = createServiceClient();

  const [templates, { data: people }, { data: vendors }, maxRecipients] = await Promise.all([
    listTemplates(),
    service.rpc("admin_email_audience", { p_segment: "everyone" }),
    service.from("vendors").select("id, name").order("name").limit(2000),
    getMaxEmailRecipients(),
  ]);

  // The automatic reminders' templates need reminder data to make sense,
  // so they aren't offered for manual sends.
  const sendable = templates.filter((t) => t.kind === "custom");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">Send an email</h1>
        <p className="text-sm font-semibold text-text-muted">
          Up to {maxRecipients} recipients per send (change this in Settings). Announcements skip people who unsubscribed.
        </p>
      </div>
      <SendEmailForm
        templates={sendable.map((t) => ({ id: t.id, name: t.name, content: rowToContent(t) }))}
        people={((people ?? []) as { user_id: string; email: string; display_name: string | null }[]).map((p) => ({
          id: p.user_id,
          email: p.email,
          name: p.display_name,
        }))}
        vendors={(vendors ?? []) as { id: string; name: string }[]}
        initialTemplateId={typeof templateId === "string" ? templateId : null}
        initialUserId={typeof userId === "string" ? userId : null}
        initialVendorId={typeof vendorId === "string" ? vendorId : null}
        siteUrl={emailSiteUrl()}
      />
    </div>
  );
}
