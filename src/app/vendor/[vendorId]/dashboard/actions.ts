"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const quoteSchema = z.object({
  eventVendorId: z.string().uuid(),
  vendorId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export interface SubmitQuoteState {
  error?: string;
}

// Gated by vendor_quotes_insert_vendor_manager (Owner/Manager only — Staff
// has view-only access to bookings and quotes per the Persona Model).
export async function submitQuote(_prevState: SubmitQuoteState, formData: FormData): Promise<SubmitQuoteState> {
  const parsed = quoteSchema.safeParse({
    eventVendorId: formData.get("eventVendorId"),
    vendorId: formData.get("vendorId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventVendorId, vendorId, amount, description } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_quotes").insert({
    event_vendor_id: eventVendorId,
    amount,
    description: description || null,
    status: "sent",
    created_by_vendor: true,
  });

  if (error) {
    return { error: "Something went wrong sending that quote. Please try again." };
  }

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  return {};
}

const serviceSchema = z.object({
  vendorId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(150),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export interface ServiceFormState {
  error?: string;
}

export async function addService(_prevState: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const parsed = serviceSchema.safeParse({
    vendorId: formData.get("vendorId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { vendorId, name, description } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_services").insert({
    vendor_id: vendorId,
    name,
    description: description || null,
  });

  if (error) {
    return { error: "Something went wrong adding that listing. Please try again." };
  }

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  return {};
}

export async function removeService(formData: FormData): Promise<void> {
  const serviceId = formData.get("serviceId");
  const vendorId = formData.get("vendorId");
  if (typeof serviceId !== "string" || typeof vendorId !== "string") return;

  const supabase = await createClient();
  await supabase.from("vendor_services").delete().eq("id", serviceId);

  revalidatePath(`/vendor/${vendorId}/dashboard`);
}
