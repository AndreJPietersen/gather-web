import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, LinkCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { listTemplates } from "@/lib/email/templates";
import { cn } from "@gather/shared/utils";

interface SentRow {
  id: string;
  subject: string;
  category: "transactional" | "announcement";
  audience: { label?: string };
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  sender: { display_name: string | null } | null;
}

// Gather-branded email: the templates (including the automatic reminders'
// wording) and a history of every admin send.
export default async function AdminEmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  await requireAdmin();
  const { tab } = await searchParams;
  const showSent = tab === "sent";

  const templates = showSent ? [] : await listTemplates();
  let sent: SentRow[] = [];
  if (showSent) {
    const service = createServiceClient();
    const { data } = await service
      .from("admin_emails")
      .select(
        "id, subject, category, audience, recipient_count, sent_count, failed_count, skipped_count, created_at, sender:profiles!admin_emails_sent_by_profiles_id_fk(display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<SentRow[]>();
    sent = data ?? [];
  }

  const tabClass = (active: boolean) =>
    cn("rounded-pill px-4 py-1.5 text-sm font-extrabold", active ? "bg-primary-soft text-primary" : "text-text-muted hover:bg-bg");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Emails</h1>
          <p className="text-sm font-semibold text-text-muted">Gather-branded templates, and emails sent from here.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/admin/emails/templates/new" variant="secondary">
            New template
          </LinkButton>
          <LinkButton href="/admin/emails/send" variant="primary">
            Send an email
          </LinkButton>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/admin/emails" className={tabClass(!showSent)}>
          Templates
        </Link>
        <Link href="/admin/emails?tab=sent" className={tabClass(showSent)}>
          Sent
        </Link>
      </div>

      {!showSent && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <LinkCard key={t.id} href={`/admin/emails/templates/${t.id}`} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink">{t.name}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase",
                    t.kind === "system" ? "bg-secondary-soft text-ink" : "bg-primary-soft text-primary",
                  )}
                >
                  {t.kind === "system" ? "Automatic" : t.category === "announcement" ? "Announcement" : "Direct"}
                </span>
              </div>
              <p className="truncate text-xs font-semibold text-text-muted">{t.subject}</p>
              <p className="text-[11px] font-semibold text-text-muted">Updated {new Date(t.updated_at).toLocaleDateString("en-ZA")}</p>
            </LinkCard>
          ))}
        </div>
      )}

      {showSent &&
        (sent.length === 0 ? (
          <LinkCard href="/admin/emails/send">
            <p className="text-sm font-semibold text-text-muted">Nothing sent yet — send your first email.</p>
          </LinkCard>
        ) : (
          <div className="flex flex-col gap-2">
            {sent.map((s) => (
              <LinkCard key={s.id} href={`/admin/emails/sent/${s.id}`} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-ink">{s.subject}</p>
                  <p className="text-xs font-semibold text-text-muted">
                    {s.audience.label ?? "—"} · {new Date(s.created_at).toLocaleString("en-ZA")} · by {s.sender?.display_name ?? "an admin"}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-bold text-text">
                  {s.sent_count}/{s.recipient_count} sent
                  {s.failed_count > 0 && <span className="text-primary"> · {s.failed_count} failed</span>}
                  {s.skipped_count > 0 && <span className="text-text-muted"> · {s.skipped_count} unsubscribed</span>}
                </p>
              </LinkCard>
            ))}
          </div>
        ))}
      {!showSent && templates.length === 0 && (
        <Card>
          <p className="text-sm font-semibold text-text-muted">No templates yet.</p>
        </Card>
      )}
    </div>
  );
}
