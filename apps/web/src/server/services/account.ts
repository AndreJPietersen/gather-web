import { createServiceClient } from "@/lib/supabase/service";
import { cleanupOrphanedStorage } from "@/lib/storage-cleanup";
import type { Caller } from "@/server/context";
import { fail, invalid, ok, type ServiceResult } from "@/server/result";

// Permanently deletes the caller's own account. The rules (what is deleted,
// what is kept and re-pointed at "Deleted user") live in the database
// function delete_account (migrations 0057/0058); this checks who is asking
// and that they meant it. The function is callable by the service role
// alone, so it is always the *caller's* id that is passed, never one from
// the request.
export async function deleteAccount(caller: Caller, input: unknown): Promise<ServiceResult> {
  const confirm = (input as { confirm?: unknown } | null)?.confirm;
  if (confirm !== "DELETE") return invalid("Type DELETE (in capitals) to confirm.");

  const { error } = await createServiceClient().rpc("delete_account", { p_user: caller.userId });
  if (error) {
    return error.message.includes("admin access")
      ? fail(409, "admin_account", "Admin accounts can't be deleted here. Ask another admin to remove your admin access first.")
      : fail(500, "delete_failed", "We couldn't delete your account. Please try again or contact support.");
  }

  // Their uploads are now unreferenced; sweep what is old enough now, the
  // daily job gets the rest. A failure here must not undo the deletion.
  await cleanupOrphanedStorage().catch(() => {});
  return ok();
}
