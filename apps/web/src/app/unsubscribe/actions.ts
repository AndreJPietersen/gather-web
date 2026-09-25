"use server";

import { revalidatePath } from "next/cache";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { setSuppressed } from "@/lib/email/suppressions";

// One-click unsubscribe from the link in an announcement email — no login,
// the signed token proves the link came from an email sent to this address.
export async function setAnnouncementSubscription(formData: FormData): Promise<void> {
  const email = String(formData.get("e") ?? "");
  const token = String(formData.get("t") ?? "");
  if (!email || !verifyUnsubscribeToken(email, token)) return;
  await setSuppressed(email, formData.get("subscribe") !== "true");
  revalidatePath("/unsubscribe");
}
