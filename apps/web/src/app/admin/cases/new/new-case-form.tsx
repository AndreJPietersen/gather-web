"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createCase, type NewCaseState } from "./actions";

const initialState: NewCaseState = {};

export function NewCaseForm() {
  const [state, formAction, pending] = useActionState(createCase, initialState);

  return (
    <Card className="flex max-w-lg flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Input name="subject" placeholder="Subject" required />
        <Input name="description" placeholder="Description (optional)" />
        <Field label="Requester email (optional)">
          <Input name="requesterEmail" type="email" placeholder="planner@example.com" />
        </Field>
        <Field label="Priority">
          <select
            name="priority"
            defaultValue="normal"
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending} className="w-fit">
          {pending ? "Creating…" : "Create case"}
        </Button>
      </form>
    </Card>
  );
}
