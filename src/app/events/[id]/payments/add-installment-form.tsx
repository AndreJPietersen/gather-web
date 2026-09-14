"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addInstallment, type InstallmentFormState } from "./actions";

const initialState: InstallmentFormState = {};

export function AddInstallmentForm({
  paymentPlanId,
  eventId,
  nextInstallmentNumber,
}: {
  paymentPlanId: string;
  eventId: string;
  nextInstallmentNumber: number;
}) {
  const [state, formAction, pending] = useActionState(addInstallment, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="paymentPlanId" value={paymentPlanId} />
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="installmentNumber" value={nextInstallmentNumber} />
        <Input name="dueDate" type="date" required />
        <Input name="amount" type="number" step="0.01" min={0.01} placeholder="Amount (ZAR)" required />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add installment"}
        </Button>
      </form>
    </Card>
  );
}
