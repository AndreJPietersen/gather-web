"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  vendorId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export interface AssociateState {
  error?: string;
}

// Deliberately minimal, matching the Salesforce build's own
// gatherVendorProfile "Associate With My Event" action: sensible defaults
// (interested, unconfirmed, no amount/notes) — full quote/payment handling
// is Phase 7's job on the resulting event_vendors row, not rebuilt here.
export async function associateWithEvent(_prevState: AssociateState, formData: FormData): Promise<AssociateState> {
  const parsed = schema.safeParse({
    vendorId: formData.get("vendorId"),
    eventId: formData.get("eventId"),
  });

  if (!parsed.success) {
    return { error: "Please choose an event." };
  }

  const { vendorId, eventId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: eventVendor, error } = await supabase
    .from("event_vendors")
    .insert({ event_id: eventId, vendor_id: vendorId })
    .select("id")
    .single();

  if (error || !eventVendor) {
    return { error: "Something went wrong adding this vendor to your event. Please try again." };
  }

  redirect(`/events/${eventId}/vendors/${eventVendor.id}`);
}
