"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createPaymentPlan, type PaymentPlanState } from "./actions";

const initialState: PaymentPlanState = {};

export function CreatePlanForm({
  eventVendorId,
  eventId,
  budgetItems,
  defaultBudgetItemId,
}: {
  eventVendorId: string;
  eventId: string;
  budgetItems: { id: string; label: string }[];
  defaultBudgetItemId?: string;
}) {
  const [state, formAction, pending] = useActionState(createPaymentPlan, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventVendorId" value={eventVendorId} />
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="totalAmount" type="number" step="0.01" min={0.01} placeholder="Total amount (ZAR)" required />
        <Input name="depositAmount" type="number" step="0.01" min={0.01} placeholder="Deposit amount (optional)" />
        <Input name="depositDueDate" type="date" />
        {budgetItems.length > 0 && (
          <Field label="Attach to a budget line (optional)">
            <select
              name="budgetItemId"
              defaultValue={defaultBudgetItemId ?? ""}
              className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
            >
              <option value="">None</option>
              {budgetItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create payment plan"}
        </Button>
      </form>
    </Card>
  );
}
