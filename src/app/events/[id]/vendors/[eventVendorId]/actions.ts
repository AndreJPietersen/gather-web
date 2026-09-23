"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// Shared by this file's own removeVendorFromEvent and, cross-imported, by
// budget/actions.ts's removeBudgetItem/unlinkVendorFromBudgetItem — one
// place for "does this vendor booking have a paid installment," the rule
// all three removal points need to enforce. Two-hop flat query (payment_
// plans -> payment_installments), same shape as this app's other
// aggregation helpers (e.g. the chat feature's getUnreadCounts), not an
// RPC. Checks for ANY paid installment, not the whole plan being settled —
// one paid installment among several pending ones is still real money that
// needs to be actively reversed (marked refunded) before the link can go
// away, regardless of what else on the plan hasn't been paid yet.
export async function hasPaidInstallment(eventVendorId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("payment_plans").select("id").eq("event_vendor_id", eventVendorId);
  const planIds = (plans ?? []).map((p) => p.id);
  if (planIds.length === 0) return false;

  const { count } = await supabase
    .from("payment_installments")
    .select("id", { count: "exact", head: true })
    .in("payment_plan_id", planIds)
    .eq("status", "paid");
  return (count ?? 0) > 0;
}

export interface RemoveVendorState {
  error?: string;
}

const removeVendorSchema = z.object({
  eventId: z.string().uuid(),
  eventVendorId: z.string().uuid(),
});

// No DELETE policy exists on event_vendors itself (deliberately — a real
// delete on this row is what the vendor_team_members/event_vendor_messages
// chat history genuinely needs to survive). "Remove" is a soft-remove:
// event_vendors.status -> 'rejected', already a valid enum value that
// nothing had ever actually written before this. The vendors list page
// filters rejected bookings out of its default view — that's what makes
// this actually read as "removed," not this action itself; direct links
// (this page, chat) still work for a removed booking, preserving its chat
// history.
//
// Its payment plan and any budget-item link are cleaned up for real,
// though (Andre's own ask, found by testing: a removed vendor's plan kept
// showing up as a phantom duplicate in the Payments picker, and the vendor
// stayed shown as "linked" on its old Budget line). Safe to actually
// delete the plan here specifically because hasPaidInstallment above
// already blocked removal entirely while any installment on it is still
// actually paid — by the time this runs, the plan can only hold pending/
// cancelled/refunded installments, nothing left worth preserving as an
// orphaned "removed vendor's plan." Deleting payment_plans cascades to its
// payment_installments automatically (onDelete: "cascade" in schema.ts) —
// an FK cascade bypasses RLS on the child table entirely, so no separate
// policy was needed there, only the new payment_plans_delete_event_editor
// policy on the plan itself.
export async function removeVendorFromEvent(_prevState: RemoveVendorState, formData: FormData): Promise<RemoveVendorState> {
  const parsed = removeVendorSchema.safeParse({
    eventId: formData.get("eventId"),
    eventVendorId: formData.get("eventVendorId"),
  });
  if (!parsed.success) {
    return { error: "Something went wrong. Please try again." };
  }
  const { eventId, eventVendorId } = parsed.data;

  if (await hasPaidInstallment(eventVendorId)) {
    return { error: "Can't remove — this vendor has a paid installment. Mark it refunded first." };
  }

  const supabase = await createClient();

  const { error: planDeleteError } = await supabase.from("payment_plans").delete().eq("event_vendor_id", eventVendorId);
  if (planDeleteError) {
    return { error: "Something went wrong removing this vendor. Please try again." };
  }

  const { error: unlinkError } = await supabase
    .from("budget_items")
    .update({ event_vendor_id: null })
    .eq("event_vendor_id", eventVendorId);
  if (unlinkError) {
    return { error: "Something went wrong removing this vendor. Please try again." };
  }

  const { error } = await supabase.from("event_vendors").update({ status: "rejected" }).eq("id", eventVendorId);
  if (error) {
    return { error: "Something went wrong removing this vendor. Please try again." };
  }

  revalidatePath(`/events/${eventId}/vendors`);
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}/payments`);
  // A removed booking has nothing left on this page worth showing (it's
  // not going to reappear in an "undo" state), so navigate straight back
  // to the list rather than leaving the client to render some leftover
  // "removed" state on a detail page for a vendor no longer active on
  // this event — the list itself already excludes rejected bookings.
  redirect(`/events/${eventId}/vendors`);
}
