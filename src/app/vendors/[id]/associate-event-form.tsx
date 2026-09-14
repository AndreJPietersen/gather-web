"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { associateWithEvent, type AssociateState } from "./actions";

const initialState: AssociateState = {};

export function AssociateEventForm({
  vendorId,
  events,
}: {
  vendorId: string;
  events: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(associateWithEvent, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <select
          name="eventId"
          required
          className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
        >
          <option value="">Choose an event…</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add to Event"}
        </Button>
      </form>
    </Card>
  );
}
