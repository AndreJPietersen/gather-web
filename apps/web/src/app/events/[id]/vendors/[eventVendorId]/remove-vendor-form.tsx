"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { removeVendorFromEvent, type RemoveVendorState } from "./actions";

const initialState: RemoveVendorState = {};

// On success the action itself redirects back to the vendors list (nothing
// worth showing stays on this page for a booking that's no longer active),
// so this component only ever has to render the blocked case — a paid
// installment on the booking's payment plan.
export function RemoveVendorForm({ eventId, eventVendorId }: { eventId: string; eventVendorId: string }) {
  const [state, formAction, pending] = useActionState(removeVendorFromEvent, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventVendorId" value={eventVendorId} />
      {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Removing…" : "Remove vendor"}
      </Button>
    </form>
  );
}
