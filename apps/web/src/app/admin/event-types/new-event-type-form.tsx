"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createEventType, type NewEventTypeState } from "./actions";

const initialState: NewEventTypeState = {};

export function NewEventTypeForm() {
  const [state, formAction, pending] = useActionState(createEventType, initialState);

  return (
    <Card className="flex max-w-sm flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input name="name" placeholder="e.g. Wedding" required className="flex-1" />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
      </form>
    </Card>
  );
}
