import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, LinkCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@gather/shared/utils";
import { supportCaseCategoryLabel } from "@gather/shared/support-case-categories";

interface CaseRow {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  category: string | null;
  created_at: string;
  requester: { display_name: string | null } | null;
}

const STATUS_FILTERS = ["open", "pending", "resolved", "closed"] as const;

const statusClasses: Record<CaseRow["status"], string> = {
  open: "bg-primary-soft text-primary",
  pending: "bg-secondary-soft text-ink",
  resolved: "bg-success-soft text-ink",
  closed: "bg-surface text-text-muted border-2 border-border",
};

const priorityClasses: Record<CaseRow["priority"], string> = {
  low: "text-text-muted",
  normal: "text-text",
  high: "text-primary",
  urgent: "text-primary font-extrabold",
};

export default async function AdminCasesPage({ searchParams }: PageProps<"/admin/cases">) {
  await requireAdmin();
  const { status } = await searchParams;
  const activeStatus = typeof status === "string" && STATUS_FILTERS.includes(status as CaseRow["status"]) ? status : "";

  const service = createServiceClient();
  let casesQuery = service
    .from("support_cases")
    .select(
      "id, subject, status, priority, category, created_at, requester:profiles!support_cases_requester_id_profiles_id_fk(display_name)",
    );
  if (activeStatus) {
    casesQuery = casesQuery.eq("status", activeStatus);
  }
  const { data: cases } = await casesQuery
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<CaseRow[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Cases</h1>
        <LinkButton href="/admin/cases/new" variant="primary">
          + New Case
        </LinkButton>
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton
          href="/admin/cases"
          variant="secondary"
          className={cn(!activeStatus && "bg-primary-soft text-primary border-transparent")}
        >
          All
        </LinkButton>
        {STATUS_FILTERS.map((s) => (
          <LinkButton
            key={s}
            href={`/admin/cases?status=${s}`}
            variant="secondary"
            className={cn(activeStatus === s && "bg-primary-soft text-primary border-transparent")}
          >
            {s}
          </LinkButton>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {cases && cases.length > 0 ? (
          cases.map((c) => (
            <LinkCard key={c.id} href={`/admin/cases/${c.id}`} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-text">{c.subject}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {c.requester?.display_name ?? "No requester"}
                  {c.category && ` · ${supportCaseCategoryLabel(c.category)}`} ·{" "}
                  <span className={priorityClasses[c.priority]}>{c.priority}</span>
                </p>
              </div>
              <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusClasses[c.status]}`}>
                {c.status}
              </span>
            </LinkCard>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No cases match.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
