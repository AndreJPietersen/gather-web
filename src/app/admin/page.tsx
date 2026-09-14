import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, LinkCard } from "@/components/ui/card";

interface AuditLogRow {
  id: string;
  action: string;
  target_table: string;
  target_id: string | null;
  created_at: string;
  admin: { display_name: string | null } | null;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const service = createServiceClient();

  const [{ count: plannerCount }, { count: vendorCount }, { count: eventCount }, { count: openCaseCount }, { data: recentActivity }] =
    await Promise.all([
      service.from("profiles").select("id", { count: "exact", head: true }),
      service.from("vendors").select("id", { count: "exact", head: true }),
      service.from("events").select("id", { count: "exact", head: true }),
      service.from("support_cases").select("id", { count: "exact", head: true }).in("status", ["open", "pending"]),
      service
        .from("admin_audit_log")
        .select("id, action, target_table, target_id, created_at, admin:profiles!admin_audit_log_admin_id_profiles_id_fk(display_name)")
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<AuditLogRow[]>(),
    ]);

  // Label and count zipped together directly, rather than two parallel
  // arrays matched by positional index — found in code review as a
  // reordering hazard (an edit to either array silently misattributes a
  // count to the wrong label with no error).
  const stats = [
    { label: "Planners", href: "/admin/planners", count: plannerCount ?? 0 },
    { label: "Vendors", href: "/admin/vendors", count: vendorCount ?? 0 },
    { label: "Events", href: "/admin/events", count: eventCount ?? 0 },
    { label: "Open Cases", href: "/admin/cases", count: openCaseCount ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <LinkCard key={stat.href} href={stat.href}>
            <p className="text-xs font-extrabold uppercase text-text-muted">{stat.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold text-ink">{stat.count}</p>
          </LinkCard>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Recent Activity</h2>
        <Card className="mt-3 flex flex-col gap-2">
          {recentActivity && recentActivity.length > 0 ? (
            recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-text">
                  {entry.admin?.display_name ?? "An admin"} — <span className="font-bold">{entry.action}</span>
                  {entry.target_table ? ` (${entry.target_table})` : ""}
                </p>
                <p className="text-xs font-semibold text-text-muted">{new Date(entry.created_at).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-text-muted">No admin activity yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
