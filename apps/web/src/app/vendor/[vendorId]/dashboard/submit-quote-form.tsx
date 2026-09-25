"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { submitQuote, type SubmitQuoteState } from "./actions";

const initialState: SubmitQuoteState = {};

// Owner/Manager: sends a quote straight to the planner. Staff
// (isSuggestion): saves it as a suggestion a Manager sends or discards.
export function SubmitQuoteForm({
  eventVendorId,
  vendorId,
  isSuggestion = false,
}: {
  eventVendorId: string;
  vendorId: string;
  isSuggestion?: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitQuote, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 border-t-2 border-border pt-2">
      <input type="hidden" name="eventVendorId" value={eventVendorId} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <CurrencyInput name="amount" placeholder="Quote amount (ZAR)" required />
      <Input name="description" placeholder="Description (optional)" />
      {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : isSuggestion ? "Suggest a Quote" : "Send a Quote"}
      </Button>
      {isSuggestion && (
        <p className="text-[11px] font-semibold text-text-muted">A Manager reviews it before the planner sees it.</p>
      )}
    </form>
  );
}
