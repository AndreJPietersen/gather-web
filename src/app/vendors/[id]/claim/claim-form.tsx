"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { submitClaim, type ClaimFormState } from "./actions";

const initialState: ClaimFormState = {};

export function ClaimForm({ vendorId }: { vendorId: string }) {
  const [state, formAction, pending] = useActionState(submitClaim, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <textarea
          name="notes"
          placeholder="How can we verify this is your business? (e.g. your role, a way to contact you back)"
          required
          rows={4}
          className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text placeholder:font-semibold placeholder:text-text-muted focus:border-primary focus:outline-none"
        />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Submitting…" : "Submit claim"}
        </Button>
      </form>
    </Card>
  );
}
