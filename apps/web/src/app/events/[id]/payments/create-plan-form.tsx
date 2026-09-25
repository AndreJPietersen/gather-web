"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { createPaymentPlan, type PaymentPlanState } from "./actions";

const initialState: PaymentPlanState = {};

export function CreatePlanForm({
  eventVendorId,
  eventId,
  budgetItems,
  defaultBudgetItemId,
  acceptedQuoteAmount,
}: {
  eventVendorId: string;
  eventId: string;
  budgetItems: { id: string; label: string }[];
  defaultBudgetItemId?: string;
  acceptedQuoteAmount?: number | null;
}) {
  const [state, formAction, pending] = useActionState(createPaymentPlan, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventVendorId" value={eventVendorId} />
        <input type="hidden" name="eventId" value={eventId} />
        <div className="flex flex-col gap-1">
          <CurrencyInput
            name="totalAmount"
            placeholder="Total amount (ZAR)"
            required
            defaultValue={acceptedQuoteAmount}
          />
          {/* The actual fix for the "accepted quote says R8,000 but the plan
              says R5,000" confusion — prefilled, not locked: a planner may
              genuinely have negotiated a different final price after the
              quote, so this is a sensible default to override, not a rule
              to enforce. */}
          {acceptedQuoteAmount !== null && acceptedQuoteAmount !== undefined && (
            <p className="text-xs font-semibold text-text-muted">
              Prefilled from the accepted quote — change it if the final price is different.
            </p>
          )}
        </div>
        <CurrencyInput name="depositAmount" placeholder="Deposit amount (optional)" />
        <Field label="Deposit due date (optional)">
          <Input name="depositDueDate" type="date" />
        </Field>
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
