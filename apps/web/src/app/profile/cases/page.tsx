import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, LinkCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/session";
import { supportCaseCategoryLabel } from "@gather/shared/support-case-categories";

interface MyCaseRow {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  category: string | null;
  created_at: string;
}

const statusClasses: Record<MyCaseRow["status"], string> = {
  open: "bg-primary-soft text-primary",
  pending: "bg-secondary-soft text-ink",
  resolved: "bg-success-soft text-ink",
  closed: "border-2 border-border bg-surface text-text-muted",
};

// The hub for the self-service side of Phase 10's Open Question #2 — same
// list-then-new shape as admin/cases, just scoped to the signed-in user's
// own reports via support_cases_select_own (schema.ts) rather than the
// service-role client the admin console reads through.
export default async function MySupportCasesPage() {
  const session = await getSessionContext();
  if (session.status !== "authenticated") {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("support_cases")
    .select("id, subject, status, category, created_at")
    .eq("requester_id", session.userId)
    .order("created_at", { ascending: false })
    .returns<MyCaseRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="My Reports">
        <p className="text-sm font-semibold text-text-muted">Issues you&apos;ve reported and their current status.</p>
      </PageHeader>

      <LinkButton href="/profile/cases/new" variant="primary">
        Report an Issue
      </LinkButton>

      <StaggerList className="flex flex-col gap-2">
        {cases && cases.length > 0 ? (
          cases.map((c) => (
            <StaggerItem key={c.id}>
              <LinkCard href={`/profile/cases/${c.id}`} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{c.subject}</p>
                  <p className="text-xs font-semibold text-text-muted">
                    {supportCaseCategoryLabel(c.category)} · {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusClasses[c.status]}`}>
                  {c.status}
                </span>
              </LinkCard>
            </StaggerItem>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">You haven&apos;t reported anything yet.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
