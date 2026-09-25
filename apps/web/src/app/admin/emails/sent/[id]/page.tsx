import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { sent: "Sent", failed: "Failed", skipped_unsubscribed: "Skipped — unsubscribed" } as const;

export default async function SentEmailPage({ params }: PageProps<"/admin/emails/sent/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const service = createServiceClient();
  const [{ data: email }, { data: recipients }] = await Promise.all([
    service
      .from("admin_emails")
      .select("id, subject, category, audience, recipient_count, sent_count, failed_count, skipped_count, created_at, sender:profiles!admin_emails_sent_by_profiles_id_fk(display_name), template:email_templates(name)")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        subject: string;
        category: string;
        audience: { label?: string };
        recipient_count: number;
        sent_count: number;
        failed_count: number;
        skipped_count: number;
        created_at: string;
        sender: { display_name: string | null } | null;
        template: { name: string } | null;
      }>(),
    service
      .from("admin_email_recipients")
      .select("id, email, status, error")
      .eq("email_id", id)
      .order("status")
      .order("email")
      .returns<{ id: string; email: string; status: keyof typeof STATUS_LABEL; error: string | null }[]>(),
  ]);
  if (!email) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">{email.subject}</h1>
        <p className="text-sm font-semibold text-text-muted">
          {email.audience.label ?? "—"} · {email.category === "announcement" ? "Announcement" : "Direct"} ·{" "}
          {new Date(email.created_at).toLocaleString("en-ZA")} · by {email.sender?.display_name ?? "an admin"}
          {email.template ? ` · from “${email.template.name}”` : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Recipients", email.recipient_count],
          ["Sent", email.sent_count],
          ["Failed", email.failed_count],
          ["Unsubscribed (skipped)", email.skipped_count],
        ].map(([k, v]) => (
          <Card key={k}>
            <p className="text-xs font-extrabold uppercase text-text-muted">{k}</p>
            <p className="mt-1 font-display text-3xl font-semibold text-ink">{v}</p>
          </Card>
        ))}
      </div>
      <Card className="flex flex-col divide-y divide-border">
        {(recipients ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="font-semibold text-text">{r.email}</span>
            <span
              className={cn(
                "text-xs font-extrabold",
                r.status === "sent" ? "text-success" : r.status === "failed" ? "text-primary" : "text-text-muted",
              )}
            >
              {STATUS_LABEL[r.status]}
              {r.error ? ` — ${r.error}` : ""}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
