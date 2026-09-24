"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPaidInstallment } from "../vendors/[eventVendorId]/actions";
import { budgetItemSchema } from "./schema";

export interface BudgetItemFormState {
  error?: string;
  success?: boolean;
}

// event_tasks/event_attendees-style owner-or-editor RLS (budget_items_insert_
// owner_or_editor) is the real enforcement — this is a planner-only table,
// same spirit as payment_plans, so there's no vendor-side branch to worry
// about here at all.
export async function createBudgetItem(_prevState: BudgetItemFormState, formData: FormData): Promise<BudgetItemFormState> {
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
  const { error } = await supabase.from("budget_items").insert({
    event_id: eventId,
    label,
    category_id: categoryId || null,
    budgeted_amount: budgetedAmount,
  });

  if (error) {
    return { error: "Something went wrong adding that budget item. Please try again." };
  }

  revalidatePath(`/events/${eventId}/budget`);
  // Back to the list on success, not another blank form — the "add several
  // suggested categories in one sitting" case just means tapping + Add
  // again, same one extra tap the equivalent installment flow now costs
  // too (see addInstallment).
  redirect(`/events/${eventId}/budget`);
}

const updateSchema = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  label: z.string().trim().min(2, "Label is too short").max(150),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  budgetedAmount: z.coerce.number().positive("Amount must be greater than zero"),
});

export async function updateBudgetItem(_prevState: BudgetItemFormState, formData: FormData): Promise<BudgetItemFormState> {
  const parsed = updateSchema.safeParse({
    itemId: formData.get("itemId"),
    eventId: formData.get("eventId"),
    label: formData.get("label"),
    categoryId: formData.get("categoryId"),
    budgetedAmount: formData.get("budgetedAmount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { itemId, eventId, label, categoryId, budgetedAmount } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_items")
    .update({ label, category_id: categoryId || null, budgeted_amount: budgetedAmount })
    .eq("id", itemId)
    .eq("event_id", eventId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Something went wrong saving that budget item. Please try again." };
  }

  revalidatePath(`/events/${eventId}/budget`);
  return { success: true };
}

const itemEventSchema = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
});

// A budget item with a linked vendor that has a paid installment can't be
// deleted out from under that payment record — deleting the row would
// silently sever budget_items -> payment_plans.budget_item_id (onDelete:
// "set null") and leave no way back from Payments to "what was this for."
// Converted from a plain fire-and-forget void action to useActionState
// (like updateBudgetItem in this same file) specifically so a blocked
// removal can actually tell the planner why instead of the button just
// doing nothing — a silent no-op isn't an option once there's a real
// reason to refuse.
export async function removeBudgetItem(_prevState: BudgetItemFormState, formData: FormData): Promise<BudgetItemFormState> {
  const parsed = itemEventSchema.safeParse({
    itemId: formData.get("itemId"),
    eventId: formData.get("eventId"),
  });
  if (!parsed.success) {
    return { error: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("budget_items")
    .select("event_vendor_id")
    .eq("id", parsed.data.itemId)
    .eq("event_id", parsed.data.eventId)
    .maybeSingle<{ event_vendor_id: string | null }>();

  if (item?.event_vendor_id && (await hasPaidInstallment(item.event_vendor_id))) {
    return { error: "Can't remove — the linked vendor has a paid installment. Mark it refunded first." };
  }

  await supabase.from("budget_items").delete().eq("id", parsed.data.itemId).eq("event_id", parsed.data.eventId);

  revalidatePath(`/events/${parsed.data.eventId}/budget`);
  return { success: true };
}

const linkVendorSchema = z.object({
  itemId: z.string().uuid(),
  eventId: z.string().uuid(),
  eventVendorId: z.string().uuid(),
});

// Links to one of the event's already-associated event_vendors rows,
// reusing that existing association rather than a new vendor-search UI —
// "one vendor per line," per this feature's own design decision, but
// nothing stops the same event_vendor being linked from more than one
// budget line (e.g. one all-in-one vendor covering two service lines).
export async function linkVendorToBudgetItem(formData: FormData): Promise<void> {
  const parsed = linkVendorSchema.safeParse({
    itemId: formData.get("itemId"),
    eventId: formData.get("eventId"),
    eventVendorId: formData.get("eventVendorId"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("budget_items")
    .update({ event_vendor_id: parsed.data.eventVendorId })
    .eq("id", parsed.data.itemId)
    .eq("event_id", parsed.data.eventId);

  // If this vendor already has exactly one payment plan, and it isn't
  // already tagged to some other budget line, tag it to this one too —
  // there's only one plan this line could mean, so skipping straight past
  // "Pending · Create a payment plan" here beats making the planner do it
  // by hand right after they just did the equivalent linking step. Left
  // alone (not stolen) when that plan is already tagged elsewhere: the
  // same event_vendor can legitimately be linked from more than one budget
  // line (see above), and silently re-pointing an already-tagged plan
  // would break that other line's own committed-amount display.
  const { data: plans } = await supabase
    .from("payment_plans")
    .select("id, budget_item_id")
    .eq("event_vendor_id", parsed.data.eventVendorId)
    .returns<{ id: string; budget_item_id: string | null }[]>();

  if (plans?.length === 1 && plans[0].budget_item_id === null) {
    await supabase.from("payment_plans").update({ budget_item_id: parsed.data.itemId }).eq("id", plans[0].id);
  }

  revalidatePath(`/events/${parsed.data.eventId}/budget`);
}

// Same guard/shape change as removeBudgetItem above, for the same reason —
// unlinking is a smaller action (the budget line survives, only the vendor
// link goes) but it's still severing the one thing that ties a paid
// installment back to a budget line.
export async function unlinkVendorFromBudgetItem(
  _prevState: BudgetItemFormState,
  formData: FormData,
): Promise<BudgetItemFormState> {
  const parsed = itemEventSchema.safeParse({
    itemId: formData.get("itemId"),
    eventId: formData.get("eventId"),
  });
  if (!parsed.success) {
    return { error: "Something went wrong. Please try again." };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("budget_items")
    .select("event_vendor_id")
    .eq("id", parsed.data.itemId)
    .eq("event_id", parsed.data.eventId)
    .maybeSingle<{ event_vendor_id: string | null }>();

  if (item?.event_vendor_id && (await hasPaidInstallment(item.event_vendor_id))) {
    return { error: "Can't unlink — this vendor has a paid installment. Mark it refunded first." };
  }

  await supabase
    .from("budget_items")
    .update({ event_vendor_id: null })
    .eq("id", parsed.data.itemId)
    .eq("event_id", parsed.data.eventId);

  revalidatePath(`/events/${parsed.data.eventId}/budget`);
  return { success: true };
}
