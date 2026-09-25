import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@gather/db/database.types";

// Every admin mutation writes one row here — editing a planner's profile,
// cancelling an event, approving/rejecting a claim, resolving a case. A
// support tool that can directly edit user data with no "who changed what,
// when" trail is a real accountability gap for a CRM-style console, not a
// nice-to-have (see docs/gather_web_admin_architecture.md's Security Notes).
// Fire-and-forget from the caller's perspective — nothing in the admin UI
// reads its own writes back mid-request, only ever as a later recent-
// activity feed — but errors are still surfaced rather than swallowed
// silently, since a failed audit write is itself worth knowing about.
export async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetTable: string;
  targetId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("admin_audit_log").insert({
    admin_id: params.adminId,
    action: params.action,
    target_table: params.targetTable,
    target_id: params.targetId ?? null,
    detail: (params.detail ?? null) as Json | null,
  });

  if (error) {
    console.error("Failed to write admin_audit_log row", params.action, error);
  }
}
