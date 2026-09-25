import { createServiceClient } from "@/lib/supabase/service";

// Announcement opt-outs (email_suppressions — admin-only table, so these run
// with the service role). Callers must already have established that the
// address is the caller's own (a verified unsubscribe token, or the
// signed-in user's own account email).

export async function isSuppressed(email: string): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service.from("email_suppressions").select("email").eq("email", email.trim().toLowerCase()).maybeSingle();
  return !!data;
}

export async function setSuppressed(email: string, suppressed: boolean): Promise<void> {
  const service = createServiceClient();
  const address = email.trim().toLowerCase();
  if (suppressed) {
    await service.from("email_suppressions").upsert({ email: address, reason: "unsubscribed" }, { onConflict: "email" });
  } else {
    await service.from("email_suppressions").delete().eq("email", address);
  }
}
