"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { attendeeSchema } from "../attendees/schema";
import { budgetItemSchema } from "../budget/schema";
import { associateWithEventSchema } from "@/app/vendors/[id]/schema";

// Three of the wizard's five steps (attendee, budget item, vendor) reuse
// the same validation/insert as their standalone-page equivalents
// (attendees/actions.ts, budget/actions.ts, vendors/[id]/actions.ts) but
// deliberately do NOT reuse those functions directly: all three redirect()
// on success — Andre's own explicit "+Add" convention for the standalone
// pages — and a Server Action's redirect() navigates the whole browser,
// which would tear down this modal wizard instead of advancing it to the
// next step. Next's own docs (redirect.md) are explicit that redirect()
// throws and must run outside any try/catch, so there's no supported way
// to call the real actions here and swallow just the navigation — these
// are thin, deliberate duplicates instead, not accidental copies. Each one
// imports its sibling's zod schema rather than re-declaring it, so a
// validation-rule change only has to be made once.
// Tasks (addTask) and the payment plan (createPaymentPlan) already stay in
// place on success, so the wizard imports and reuses those two unchanged.

export interface WizardAttendeeState {
  error?: string;
}

export async function addAttendeeForWizard(_prevState: WizardAttendeeState, formData: FormData): Promise<WizardAttendeeState> {
  const parsed = attendeeSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
    guestCount: formData.get("guestCount") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventId, name, email, guestCount } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("event_attendees").insert({
    event_id: eventId,
    name,
    email: email || null,
    guest_count: guestCount,
    rsvp_status: "no_response",
  });

  if (error) {
    return { error: "Something went wrong adding that attendee. Please try again." };
  }

  revalidatePath(`/events/${eventId}/attendees`);
  revalidatePath(`/events/${eventId}`);
  return {};
}

export interface WizardBudgetItemState {
  error?: string;
  budgetItemId?: string;
  label?: string;
}

export async function createBudgetItemForWizard(
  _prevState: WizardBudgetItemState,
  formData: FormData,
): Promise<WizardBudgetItemState> {
  const parsed = budgetItemSchema.safeParse({
    eventId: formData.get("eventId"),
    label: formData.get("label"),
    categoryId: formData.get("categoryId"),
    budgetedAmount: formData.get("budgetedAmount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventId, label, categoryId, budgetedAmount } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_items")
    .insert({
      event_id: eventId,
      label,
      category_id: categoryId || null,
      budgeted_amount: budgetedAmount,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Something went wrong adding that budget item. Please try again." };
  }

  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}`);
  return { budgetItemId: data.id, label };
}

export interface WizardVendorState {
  error?: string;
  eventVendorId?: string;
}

export async function addVendorToEventForWizard(_prevState: WizardVendorState, formData: FormData): Promise<WizardVendorState> {
  const parsed = associateWithEventSchema.safeParse({
    eventId: formData.get("eventId"),
    vendorId: formData.get("vendorId"),
  });

  if (!parsed.success) {
    return { error: "Something went wrong adding that vendor. Please try again." };
  }

  const { eventId, vendorId } = parsed.data;

  const supabase = await createClient();
  // The standalone associateWithEvent this is forked from redirects to
  // /login when the session has expired — this wizard action can't
  // redirect() (it would tear down the modal instead of advancing it, see
  // the file header), but it still needs the same check: without it, an
  // expired-session insert just fails RLS and surfaces a generic "went
  // wrong" error with no path back to re-authenticating.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }

  const { data, error } = await supabase
    .from("event_vendors")
    .insert({ event_id: eventId, vendor_id: vendorId })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Something went wrong adding this vendor to your event. Please try again." };
  }

  revalidatePath(`/events/${eventId}/vendors`);
  revalidatePath(`/events/${eventId}`);
  return { eventVendorId: data.id };
}
