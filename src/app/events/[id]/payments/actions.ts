"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const planSchema = z.object({
  eventVendorId: z.string().uuid(),
  eventId: z.string().uuid(),
  totalAmount: z.coerce.number().positive("Total amount must be greater than zero"),
  depositAmount: z.coerce.number().positive().optional(),
  depositDueDate: z.string().optional().or(z.literal("")),
  budgetItemId: z.string().uuid().optional().or(z.literal("")),
});

export interface PaymentPlanState {
  error?: string;
}

export async function createPaymentPlan(_prevState: PaymentPlanState, formData: FormData): Promise<PaymentPlanState> {
  const parsed = planSchema.safeParse({
    eventVendorId: formData.get("eventVendorId"),
    eventId: formData.get("eventId"),
    totalAmount: formData.get("totalAmount"),
    depositAmount: formData.get("depositAmount") || undefined,
    depositDueDate: formData.get("depositDueDate"),
    budgetItemId: formData.get("budgetItemId") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventVendorId, eventId, totalAmount, depositAmount, depositDueDate, budgetItemId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("payment_plans").insert({
    event_vendor_id: eventVendorId,
    total_amount: totalAmount,
    deposit_amount: depositAmount ?? null,
    deposit_due_date: depositDueDate || null,
    budget_item_id: budgetItemId || null,
  });

  if (error) {
    return { error: "Something went wrong creating the payment plan. Please try again." };
  }

  revalidatePath(`/events/${eventId}/payments`);
  revalidatePath(`/events/${eventId}/budget`);
  return {};
}

const planBudgetItemSchema = z.object({
  planId: z.string().uuid(),
  eventId: z.string().uuid(),
  budgetItemId: z.string().uuid().optional().or(z.literal("")),
});

// Tags (or re-tags/clears) an EXISTING plan to a budget item — distinct
// from createPaymentPlan's own optional budgetItemId field, which only
// applies at creation time. A plan created before a budget item existed
// (or before Budget was even a feature) would otherwise have no way back
// to being tagged, leaving the budget page's per-line display permanently
// showing "No payment plan yet" even though a real plan exists.
export async function setPlanBudgetItem(formData: FormData): Promise<void> {
  const parsed = planBudgetItemSchema.safeParse({
    planId: formData.get("planId"),
    eventId: formData.get("eventId"),
    budgetItemId: formData.get("budgetItemId") || "",
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("payment_plans")
    .update({ budget_item_id: parsed.data.budgetItemId || null })
    .eq("id", parsed.data.planId);

  revalidatePath(`/events/${parsed.data.eventId}/payments`);
  revalidatePath(`/events/${parsed.data.eventId}/budget`);
}

export async function activatePlan(formData: FormData): Promise<void> {
  const planId = formData.get("planId");
  const eventId = formData.get("eventId");
  if (typeof planId !== "string" || typeof eventId !== "string") return;

  const supabase = await createClient();
  await supabase.from("payment_plans").update({ status: "active" }).eq("id", planId);

  revalidatePath(`/events/${eventId}/payments`);
}

const installmentSchema = z.object({
  paymentPlanId: z.string().uuid(),
  eventId: z.string().uuid(),
  installmentNumber: z.coerce.number().int().positive(),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

export interface InstallmentFormState {
  error?: string;
}

export async function addInstallment(_prevState: InstallmentFormState, formData: FormData): Promise<InstallmentFormState> {
  const parsed = installmentSchema.safeParse({
    paymentPlanId: formData.get("paymentPlanId"),
    eventId: formData.get("eventId"),
    installmentNumber: formData.get("installmentNumber"),
    dueDate: formData.get("dueDate"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { paymentPlanId, eventId, installmentNumber, dueDate, amount } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("payment_installments").insert({
    payment_plan_id: paymentPlanId,
    installment_number: installmentNumber,
    due_date: dueDate,
    amount,
  });

  if (error) {
    // The DB trigger (payment_installments_check_sum) raises a plain-text
    // exception when installments would exceed the plan total — surface
    // that message directly rather than a generic fallback, since it's
    // already written to be user-readable.
    return { error: error.message.includes("would exceed") ? error.message : "Something went wrong adding that installment." };
  }

  revalidatePath(`/events/${eventId}/payments`);
  return {};
}

export async function markInstallmentPaid(formData: FormData): Promise<void> {
  const installmentId = formData.get("installmentId");
  const eventId = formData.get("eventId");
  if (typeof installmentId !== "string" || typeof eventId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("payment_installments")
    .update({ status: "paid", paid_on: new Date().toISOString().slice(0, 10) })
    .eq("id", installmentId);

  revalidatePath(`/events/${eventId}/payments`);
}
