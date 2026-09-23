"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { createBudgetItem, type BudgetItemFormState } from "./actions";

const initialState: BudgetItemFormState = {};

export function AddBudgetItemForm({
  eventId,
  categories,
  prefillLabel,
  prefillCategoryId,
}: {
  eventId: string;
  categories: { id: string; name: string }[];
  // Set by BudgetItemsPanel when a suggested category chip is tapped — the
  // amount is always left for the planner to fill in themselves (there's no
  // "typical price" data anywhere in the schema to seed it from), so this
  // only ever prefills label/category and moves focus to the amount field.
  prefillLabel?: string;
  prefillCategoryId?: string;
}) {
  const [state, formAction, pending] = useActionState(createBudgetItem, initialState);
  const amountRef = useRef<HTMLInputElement>(null);

  // BudgetItemsPanel remounts this form (via `key`) whenever a suggestion
  // is tapped, so a plain mount-time focus is enough to land the planner
  // straight on the one field a suggestion can't fill in for them.
  useEffect(() => {
    if (prefillLabel) amountRef.current?.focus();
  }, [prefillLabel]);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="label" placeholder="Line item (e.g. Catering)" defaultValue={prefillLabel} required />
        <Field label="Category (optional)">
          <select
            name="categoryId"
            defaultValue={prefillCategoryId ?? ""}
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <CurrencyInput ref={amountRef} name="budgetedAmount" placeholder="Budgeted amount (ZAR)" required />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add budget item"}
        </Button>
      </form>
    </Card>
  );
}
