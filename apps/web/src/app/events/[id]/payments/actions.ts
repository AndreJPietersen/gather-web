"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  eventVendorId: z.string().uuid(),
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
    eventVendorId: formData.get("eventVendorId"),
    installmentNumber: formData.get("installmentNumber"),
    dueDate: formData.get("dueDate"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { paymentPlanId, eventId, eventVendorId, installmentNumber, dueDate, amount } = parsed.data;

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
  redirect(`/events/${eventId}/payments?vendor=${eventVendorId}`);
}

// A draft plan is still being worked out — its total/deposit can still
// change, and payment_installments_check_sum only validates against
// whatever total_amount happens to be *right now*, not a final agreed
// figure. Marking something paid against numbers that might still move is
// what "Activate Plan" exists to draw a line under, so this is blocked
// server-side (not just hidden in the UI, which a direct POST to this
// Server Action would bypass) until the plan is out of draft.
export async function markInstallmentPaid(formData: FormData): Promise<void> {
  const installmentId = formData.get("installmentId");
  const eventId = formData.get("eventId");
  if (typeof installmentId !== "string" || typeof eventId !== "string") return;

  const supabase = await createClient();
  const { data: installment } = await supabase
    .from("payment_installments")
    .select("payment_plans(status)")
    .eq("id", installmentId)
    .maybeSingle<{ payment_plans: { status: string } | null }>();
  if (!installment || installment.payment_plans?.status === "draft") return;

  await supabase
    .from("payment_installments")
    .update({ status: "paid", paid_on: new Date().toISOString().slice(0, 10) })
    .eq("id", installmentId);

  revalidatePath(`/events/${eventId}/payments`);
}

// The escape hatch a vendor/budget removal being blocked on a paid
// installment (see hasPaidInstallment) actually points the planner at —
// flips status to 'refunded' without touching paid_on, which stays exactly
// what it already was: a true historical record of when the money was
// received, not something a later reversal should erase. Once refunded, an
// installment no longer counts as "paid" anywhere that matters — the
// header's Paid/Outstanding split above already only sums status ===
// "paid", and hasPaidInstallment's own check is the same equality, so both
// naturally stop counting it with no extra logic needed here.
export async function markInstallmentRefunded(formData: FormData): Promise<void> {
  const installmentId = formData.get("installmentId");
  const eventId = formData.get("eventId");
  if (typeof installmentId !== "string" || typeof eventId !== "string") return;

  const supabase = await createClient();
  await supabase.from("payment_installments").update({ status: "refunded" }).eq("id", installmentId);

  revalidatePath(`/events/${eventId}/payments`);
}

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export interface ProofOfPaymentState {
  error?: string;
}

// A proof-of-payment document — a bank EFT screenshot, a forwarded email
// receipt — attached directly to the installment it proves, so it's "not
// lost in a mailbox." One file per installment: uploading a new one
// replaces (and cleans up) whatever was there before, same as the plan is
// "the current evidence for this payment," not a history of every upload.
// Storage upload happens before the DB write and is rolled back on failure,
// same ordering as uploadEventGalleryImage.
export async function uploadProofOfPayment(
  _prevState: ProofOfPaymentState,
  formData: FormData,
): Promise<ProofOfPaymentState> {
  const installmentId = formData.get("installmentId");
  const eventId = formData.get("eventId");
  const file = formData.get("file");

  if (typeof installmentId !== "string" || !z.string().uuid().safeParse(installmentId).success) {
    return { error: "Something went wrong. Please try again." };
  }
  if (typeof eventId !== "string") {
    return { error: "Something went wrong. Please try again." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }
  if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
    return { error: "Please upload a JPEG, PNG, WebP image, or PDF." };
  }
  if (file.size > MAX_PROOF_BYTES) {
    return { error: "That file is too large — please keep it under 10MB." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("payment_installments")
    .select("proof_of_payment_path")
    .eq("id", installmentId)
    .single();

  const extension =
    file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${installmentId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { error: "Couldn't upload that file. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("payment_installments")
    .update({ proof_of_payment_path: path })
    .eq("id", installmentId);

  if (updateError) {
    await supabase.storage.from("payment-proofs").remove([path]);
    return { error: "Something went wrong saving that file. Please try again." };
  }

  if (existing?.proof_of_payment_path) {
    await supabase.storage.from("payment-proofs").remove([existing.proof_of_payment_path]);
  }

  revalidatePath(`/events/${eventId}/payments`);
  return {};
}

export async function removeProofOfPayment(formData: FormData): Promise<void> {
  const installmentId = formData.get("installmentId");
  const eventId = formData.get("eventId");
  const storagePath = formData.get("storagePath");
  if (typeof installmentId !== "string" || typeof eventId !== "string" || typeof storagePath !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_installments")
    .update({ proof_of_payment_path: null })
    .eq("id", installmentId);
  if (!error) {
    await supabase.storage.from("payment-proofs").remove([storagePath]);
  }

  revalidatePath(`/events/${eventId}/payments`);
}
