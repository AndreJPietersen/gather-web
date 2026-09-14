"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  eventId: z.string().uuid(),
  label: z.string().trim().min(2, "Label is too short").max(150),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  budgetedAmount: z.coerce.number().positive("Amount must be greater than zero"),
});

export interface BudgetItemFormState {
  error?: string;
  success?: boolean;
}

// event_tasks/event_attendees-style owner-or-editor RLS (budget_items_insert_
// owner_or_editor) is the real enforcement — this is a planner-only table,
// same spirit as payment_plans, so there's no vendor-side branch to worry
// about here at all.
export async function createBudgetItem(_prevState: BudgetItemFormState, formData: FormData): Promise<BudgetItemFormState> {
  const parsed = createSchema.safeParse({
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
  return { success: true };
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

export async function removeBudgetItem(formData: FormData): Promise<void> {
  const parsed = itemEventSchema.safeParse({
    itemId: formData.get("itemId"),
    eventId: formData.get("eventId"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("budget_items").delete().eq("id", parsed.data.itemId).eq("event_id", parsed.data.eventId);

  revalidatePath(`/events/${parsed.data.eventId}/budget`);
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

  revalidatePath(`/events/${parsed.data.eventId}/budget`);
}

export async function unlinkVendorFromBudgetItem(formData: FormData): Promise<void> {
  const parsed = itemEventSchema.safeParse({
    itemId: formData.get("itemId"),
    eventId: formData.get("eventId"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("budget_items")
    .update({ event_vendor_id: null })
    .eq("id", parsed.data.itemId)
    .eq("event_id", parsed.data.eventId);

  revalidatePath(`/events/${parsed.data.eventId}/budget`);
}
