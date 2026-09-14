"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addTask, type TaskFormState } from "./actions";

const initialState: TaskFormState = {};

export function AddTaskForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(addTask, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="title" placeholder="Task (e.g. Book the venue)" required />
        <Input name="dueDate" type="date" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add task"}
        </Button>
      </form>
    </Card>
  );
}
