"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { addInstallment, type InstallmentFormState } from "./actions";

const initialState: InstallmentFormState = {};

export function AddInstallmentForm({
  paymentPlanId,
  eventId,
  eventVendorId,
  nextInstallmentNumber,
}: {
  paymentPlanId: string;
  eventId: string;
  // Only needed to build the redirect back to the right vendor's plan on
  // success (the Payments page is keyed off ?vendor=, not paymentPlanId) —
  // addInstallment itself still authorizes purely off paymentPlanId.
  eventVendorId: string;
  nextInstallmentNumber: number;
}) {
  const [state, formAction, pending] = useActionState(addInstallment, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="paymentPlanId" value={paymentPlanId} />
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="eventVendorId" value={eventVendorId} />
        <input type="hidden" name="installmentNumber" value={nextInstallmentNumber} />
        <Field label="Due date">
          <Input name="dueDate" type="date" required />
        </Field>
        <CurrencyInput name="amount" placeholder="Amount (ZAR)" required />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add installment"}
        </Button>
      </form>
    </Card>
  );
}
