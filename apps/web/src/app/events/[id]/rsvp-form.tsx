"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fireSuccessConfetti } from "@/lib/confetti";
import { submitRsvp, type RsvpState } from "./actions";

const initialState: RsvpState = {};

export function RsvpForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(submitRsvp, initialState);

  useEffect(() => {
    if (state.success) {
      fireSuccessConfetti();
    }
  }, [state.success]);

  if (state.success) {
    return (
      <Card>
        <p className="text-sm font-bold text-text">You&apos;re on the list. See you there!</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="name" placeholder="Your name" required autoComplete="name" />
        <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <Input name="phone" type="tel" placeholder="Phone (optional)" autoComplete="tel" />
        <Field label="Additional guests">
          <Input name="guestCount" type="number" min={0} max={20} defaultValue={0} className="w-24" />
        </Field>
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Submitting…" : "I'll be there"}
        </Button>
      </form>
    </Card>
  );
}
