"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addAttendee, type AttendeeFormState } from "./actions";

const initialState: AttendeeFormState = {};

export function AddAttendeeForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(addAttendee, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="name" placeholder="Attendee name" required />
        <Input name="email" type="email" placeholder="Email (optional)" />
        <Input name="guestCount" type="number" min={0} max={20} placeholder="Additional guests" defaultValue={0} />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add attendee"}
        </Button>
      </form>
    </Card>
  );
}
