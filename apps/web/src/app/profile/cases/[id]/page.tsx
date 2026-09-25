import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/session";
import { supportCaseCategoryLabel } from "@gather/shared/support-case-categories";

interface MyCaseDetail {
  id: string;
  subject: string;
  description: string | null;
  status: "open" | "pending" | "resolved" | "closed";
  category: string | null;
  attachment_path: string | null;
  created_at: string;
}

const statusClasses: Record<MyCaseDetail["status"], string> = {
  open: "bg-primary-soft text-primary",
  pending: "bg-secondary-soft text-ink",
  resolved: "bg-success-soft text-ink",
  closed: "border-2 border-border bg-surface text-text-muted",
};

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Read-only — a reporter can see where their own case stands
// (support_cases_select_own, schema.ts) but not the comment thread, which
// stays admin-only (see the schema's Phase 10 section comment for why).
export default async function MySupportCaseDetailPage({ params }: PageProps<"/profile/cases/[id]">) {
  const session = await getSessionContext();
  const { id } = await params;
  const supabase = await createClient();

  const { data: supportCase } = await supabase
    .from("support_cases")
    .select("id, subject, description, status, category, attachment_path, created_at")
    .eq("id", id)
    .maybeSingle<MyCaseDetail>();

  // RLS already restricts this to the requester's own cases, but a stray id
  // (someone else's, or mistyped) should read as "not found," not leak
  // whether the row exists at all.
  if (session.status !== "authenticated" || !supportCase) {
    notFound();
  }

  let attachmentUrl: string | null = null;
  if (supportCase.attachment_path) {
    const { data } = await supabase.storage
      .from("support-case-attachments")
      .createSignedUrl(supportCase.attachment_path, SIGNED_URL_TTL_SECONDS);
    attachmentUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title={supportCase.subject}>
        <p className="text-sm font-semibold text-text-muted">
          {supportCaseCategoryLabel(supportCase.category)} · Reported {new Date(supportCase.created_at).toLocaleDateString()}
        </p>
        <span
          className={`w-fit rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusClasses[supportCase.status]}`}
        >
          {supportCase.status}
        </span>
      </PageHeader>

      {supportCase.description && (
        <Card>
          <p className="text-sm font-semibold text-text">{supportCase.description}</p>
        </Card>
      )}

      {attachmentUrl && (
        <div className="overflow-hidden rounded-[22px] bg-surface shadow-[0_6px_16px_-8px_var(--color-ink)]">
          {/* eslint-disable-next-line @next/next/no-img-element --
              a signed Storage URL isn't a static/optimizable asset next/image
              can source-check at build time. */}
          <img src={attachmentUrl} alt="Attached screenshot" className="w-full object-cover" />
        </div>
      )}
    </main>
  );
}
