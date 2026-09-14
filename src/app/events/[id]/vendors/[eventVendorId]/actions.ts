"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  quoteId: z.string().uuid(),
  eventId: z.string().uuid(),
  eventVendorId: z.string().uuid(),
});

export interface AcceptQuoteState {
  error?: string;
  success?: boolean;
}

// Accepting a quote must decline any other already-Accepted quote on this
// relationship FIRST — the partial unique index (vendor_quotes_one_accepted_
// per_event_vendor) would otherwise reject this update outright, since two
// Accepted rows for the same event_vendor_id can never coexist. Two
// sequential writes, not a single wrapped transaction (supabase-js has no
// simple multi-statement client transaction) — an acceptable simplification
// for a single-user-initiated action, same tradeoff already made for the
// two-insert vendor self-registration in Phase 4.
//
// Deliberately no revalidatePath here, unlike declineQuote below — this
// action is driven by useActionState (so AcceptQuoteForm can fire confetti
// on a real success signal), and Phase 4 already found that bundling a
// server-triggered re-render into the same response can reseed the client
// tree before useActionState's returned value is read, silently discarding
// {success: true}. Same tradeoff already made for inviteCollaborator: the
// button shows its own success state immediately, the rest of the page's
// quote list catches up on the next normal navigation/reload.
export async function acceptQuote(_prevState: AcceptQuoteState, formData: FormData): Promise<AcceptQuoteState> {
  const parsed = schema.safeParse({
    quoteId: formData.get("quoteId"),
    eventId: formData.get("eventId"),
    eventVendorId: formData.get("eventVendorId"),
  });
  if (!parsed.success) {
    return { error: "Something went wrong. Please try again." };
  }

  const { quoteId, eventVendorId } = parsed.data;
  const supabase = await createClient();

  await supabase
    .from("vendor_quotes")
    .update({ status: "declined" })
    .eq("event_vendor_id", eventVendorId)
    .eq("status", "accepted");

  // Scoped to .eq("status", "sent") — an already-declined/expired quote
  // (e.g. a stale tab, a double-submit) shouldn't be flippable back to
  // accepted just because its id still validates.
  const { error } = await supabase
    .from("vendor_quotes")
    .update({ status: "accepted" })
    .eq("id", quoteId)
    .eq("status", "sent");

  if (error) {
    return { error: "Something went wrong accepting this quote. Please try again." };
  }

  return { success: true };
}

const confirmedSchema = z.object({
  eventId: z.string().uuid(),
  eventVendorId: z.string().uuid(),
  confirmed: z.enum(["true", "false"]),
});

// event_vendors.confirmed has existed since Phase 7 but this project's own
// research confirmed it was entirely dead — the column defaults to false
// and nothing anywhere ever wrote to it, even though
// event_vendors_update_event_editor_or_vendor_manager already permits it.
// A plain fire-and-forget toggle, same shape as declineQuote, since this
// is a two-state flip with nothing worth a per-field error display.
export async function setVendorConfirmed(formData: FormData): Promise<void> {
  const parsed = confirmedSchema.safeParse({
    eventId: formData.get("eventId"),
    eventVendorId: formData.get("eventVendorId"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) return;

  const { eventId, eventVendorId, confirmed } = parsed.data;
  const supabase = await createClient();

  await supabase
    .from("event_vendors")
    .update({ confirmed: confirmed === "true" })
    .eq("id", eventVendorId);

  revalidatePath(`/events/${eventId}/vendors/${eventVendorId}`);
  revalidatePath(`/events/${eventId}/vendors`);
  revalidatePath(`/events/${eventId}/budget`);
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

  // Scoped to .eq("status", "sent") — the real fix for "the Decline button
  // could revert an already-Accepted quote" is AcceptQuoteForm's
  // router.refresh() making the button disappear once the page's data is
  // current, but this guard is the actual invariant: declining should never
  // silently undo an acceptance regardless of what a client happens to be
  // showing (a stale tab, a race between two clicks).
  await supabase.from("vendor_quotes").update({ status: "declined" }).eq("id", quoteId).eq("status", "sent");

  revalidatePath(`/events/${eventId}/vendors/${eventVendorId}`);
}
