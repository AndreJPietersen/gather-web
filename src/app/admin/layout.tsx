import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/require-admin";
import { AdminSidebar } from "./admin-sidebar";

// A layout can't be bypassed by any request under this segment, so this
// alone would already gate every /admin page — but per this project's own
// security principle (see docs/gather_web_admin_architecture.md), every
// page and every Server Action still calls requireAdmin() itself too,
// since a Server Action's own invocation never re-runs this layout at all.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex min-h-full w-full">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
