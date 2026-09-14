"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createBudgetItem, type BudgetItemFormState } from "./actions";

const initialState: BudgetItemFormState = {};

export function AddBudgetItemForm({
  eventId,
  categories,
}: {
  eventId: string;
  categories: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createBudgetItem, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Same shape as AddAttendeeForm: revalidatePath alone refreshes the list
  // and clears the form by remounting it — router.refresh() here is just
  // the belt-and-suspenders companion this session's earlier bugs showed
  // is worth keeping for anything staying on the same page after a write.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <Card className="flex flex-col gap-3">
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="label" placeholder="Line item (e.g. Catering)" required />
        <Field label="Category (optional)">
          <select
            name="categoryId"
            defaultValue=""
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
        <Input name="budgetedAmount" type="number" step="0.01" min={0.01} placeholder="Budgeted amount (ZAR)" required />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add budget item"}
        </Button>
      </form>
    </Card>
  );
}
