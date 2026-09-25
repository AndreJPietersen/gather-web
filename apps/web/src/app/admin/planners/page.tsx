import { DELETED_USER_ID } from "@gather/shared/legal-info";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, LinkCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PlannerRow {
  id: string;
  display_name: string | null;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
}

export default async function AdminPlannersPage({ searchParams }: PageProps<"/admin/planners">) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const service = createServiceClient();
  // The "Deleted user" placeholder (migration 0057) is not a real person.
  let plannersQuery = service.from("profiles").select("id, display_name, phone, is_admin, created_at").neq("id", DELETED_USER_ID);
  if (query) {
    plannersQuery = plannersQuery.ilike("display_name", `%${query}%`);
  }
  const { data: planners } = await plannersQuery
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<PlannerRow[]>();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Planners</h1>

      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Search by name" className="max-w-xs" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {planners && planners.length > 0 ? (
          planners.map((planner) => (
            <LinkCard
              key={planner.id}
              href={`/admin/planners/${planner.id}`}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-bold text-text">{planner.display_name ?? "Unnamed planner"}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {planner.phone ?? "No phone on file"} · Joined {new Date(planner.created_at).toLocaleDateString()}
                </p>
              </div>
              {planner.is_admin && (
                <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                  Admin
                </span>
              )}
            </LinkCard>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No planners match.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
