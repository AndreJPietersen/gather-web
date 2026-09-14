"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitQuote, type SubmitQuoteState } from "./actions";

const initialState: SubmitQuoteState = {};

export function SubmitQuoteForm({ eventVendorId, vendorId }: { eventVendorId: string; vendorId: string }) {
  const [state, formAction, pending] = useActionState(submitQuote, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 border-t-2 border-border pt-2">
      <input type="hidden" name="eventVendorId" value={eventVendorId} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <Input name="amount" type="number" step="0.01" min={0.01} placeholder="Quote amount (ZAR)" required />
      <Input name="description" placeholder="Description (optional)" />
      {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send a Quote"}
      </Button>
    </form>
  );
}
