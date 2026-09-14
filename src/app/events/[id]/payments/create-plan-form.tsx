"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPaymentPlan, type PaymentPlanState } from "./actions";

const initialState: PaymentPlanState = {};

export function CreatePlanForm({ eventVendorId, eventId }: { eventVendorId: string; eventId: string }) {
  const [state, formAction, pending] = useActionState(createPaymentPlan, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventVendorId" value={eventVendorId} />
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="totalAmount" type="number" step="0.01" min={0.01} placeholder="Total amount (ZAR)" required />
        <Input name="depositAmount" type="number" step="0.01" min={0.01} placeholder="Deposit amount (optional)" />
        <Input name="depositDueDate" type="date" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create payment plan"}
        </Button>
      </form>
    </Card>
  );
}
