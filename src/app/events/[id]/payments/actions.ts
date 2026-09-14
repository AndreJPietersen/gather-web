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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventVendorId, eventId, totalAmount, depositAmount, depositDueDate } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("payment_plans").insert({
    event_vendor_id: eventVendorId,
    total_amount: totalAmount,
    deposit_amount: depositAmount ?? null,
    deposit_due_date: depositDueDate || null,
  });

  if (error) {
    return { error: "Something went wrong creating the payment plan. Please try again." };
  }

  revalidatePath(`/events/${eventId}/payments`);
  return {};
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
