import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card, LinkCard } from "@/components/ui/card";
import { updateCaseStatus } from "./actions";
import { CommentForm } from "./comment-form";

interface CaseDetail {
  id: string;
  subject: string;
  description: string | null;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  requester: { id: string; display_name: string | null } | null;
  related_event: { id: string; name: string } | null;
  related_vendor: { id: string; name: string } | null;
}

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  author: { display_name: string | null } | null;
}

const STATUS_OPTIONS = ["open", "pending", "resolved", "closed"] as const;

export default async function AdminCaseDetailPage({ params }: PageProps<"/admin/cases/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const service = createServiceClient();

  const { data: supportCase } = await service
    .from("support_cases")
    .select(
      "id, subject, description, status, priority, created_at, requester:profiles!support_cases_requester_id_profiles_id_fk(id, display_name), related_event:events(id, name), related_vendor:vendors(id, name)",
    )
    .eq("id", id)
    .maybeSingle<CaseDetail>();

  if (!supportCase) {
    notFound();
  }

  const { data: comments } = await service
    .from("support_case_comments")
    .select("id, body, created_at, author:profiles!support_case_comments_author_id_profiles_id_fk(display_name)")
    .eq("case_id", id)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">{supportCase.subject}</h1>
        <p className="text-sm font-semibold text-text-muted">
          {supportCase.requester?.display_name ?? "No requester"} · {supportCase.priority} priority · Logged{" "}
          {new Date(supportCase.created_at).toLocaleDateString()}
        </p>
      </div>

      {supportCase.description && (
        <Card>
          <p className="text-sm font-semibold text-text">{supportCase.description}</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-extrabold uppercase text-text-muted">Status:</span>
        {STATUS_OPTIONS.map((status) => (
          <form key={status} action={updateCaseStatus}>
            <input type="hidden" name="caseId" value={supportCase.id} />
            <input type="hidden" name="status" value={status} />
            <button
              type="submit"
              className={`rounded-pill px-3 py-1 text-xs font-extrabold uppercase transition-opacity active:opacity-70 ${
                supportCase.status === status ? "bg-primary-soft text-primary" : "border-2 border-border bg-surface text-text-muted"
              }`}
            >
              {status}
            </button>
          </form>
        ))}
      </div>

      {(supportCase.requester || supportCase.related_event || supportCase.related_vendor) && (
        <div className="flex flex-wrap gap-2">
          {supportCase.requester && (
            <LinkCard href={`/admin/planners/${supportCase.requester.id}`} className="w-fit">
              <p className="text-xs font-semibold text-text-muted">
                Requester: <span className="font-bold text-text">{supportCase.requester.display_name ?? "Unknown"}</span>
              </p>
            </LinkCard>
          )}
          {supportCase.related_event && (
            <LinkCard href={`/admin/events/${supportCase.related_event.id}`} className="w-fit">
              <p className="text-xs font-semibold text-text-muted">
                Event: <span className="font-bold text-text">{supportCase.related_event.name}</span>
              </p>
            </LinkCard>
          )}
          {supportCase.related_vendor && (
            <LinkCard href={`/admin/vendors/${supportCase.related_vendor.id}`} className="w-fit">
              <p className="text-xs font-semibold text-text-muted">
                Vendor: <span className="font-bold text-text">{supportCase.related_vendor.name}</span>
              </p>
            </LinkCard>
          )}
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Comments ({comments?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {comments && comments.length > 0 ? (
            comments.map((c) => (
              <Card key={c.id} className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-text">{c.body}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {c.author?.display_name ?? "An admin"} · {new Date(c.created_at).toLocaleString()}
                </p>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No comments yet.</p>
            </Card>
          )}
        </div>
        <div className="mt-3">
          <CommentForm caseId={supportCase.id} />
        </div>
      </div>
    </div>
  );
}
