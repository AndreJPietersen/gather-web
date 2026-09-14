"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  quoteId: z.string().uuid(),
  eventId: z.string().uuid(),
  eventVendorId: z.string().uuid(),
});

// Accepting a quote must decline any other already-Accepted quote on this
// relationship FIRST — the partial unique index (vendor_quotes_one_accepted_
// per_event_vendor) would otherwise reject this update outright, since two
// Accepted rows for the same event_vendor_id can never coexist. Two
// sequential writes, not a single wrapped transaction (supabase-js has no
// simple multi-statement client transaction) — an acceptable simplification
// for a single-user-initiated action, same tradeoff already made for the
// two-insert vendor self-registration in Phase 4.
export async function acceptQuote(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    quoteId: formData.get("quoteId"),
    eventId: formData.get("eventId"),
    eventVendorId: formData.get("eventVendorId"),
  });
  if (!parsed.success) return;

  const { quoteId, eventId, eventVendorId } = parsed.data;
  const supabase = await createClient();

  await supabase
    .from("vendor_quotes")
    .update({ status: "declined" })
    .eq("event_vendor_id", eventVendorId)
    .eq("status", "accepted");

  await supabase.from("vendor_quotes").update({ status: "accepted" }).eq("id", quoteId);

  revalidatePath(`/events/${eventId}/vendors/${eventVendorId}`);
}

export async function declineQuote(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    quoteId: formData.get("quoteId"),
    eventId: formData.get("eventId"),
    eventVendorId: formData.get("eventVendorId"),
  });
  if (!parsed.success) return;

  const { quoteId, eventId, eventVendorId } = parsed.data;
  const supabase = await createClient();

  await supabase.from("vendor_quotes").update({ status: "declined" }).eq("id", quoteId);

  revalidatePath(`/events/${eventId}/vendors/${eventVendorId}`);
}
