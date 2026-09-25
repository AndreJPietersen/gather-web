"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { completePlannerProfile, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

export function PlannerOnboardingForm() {
  const [state, formAction, pending] = useActionState(completePlannerProfile, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Input name="name" placeholder="Your name" required autoComplete="name" />
        <Input name="phone" type="tel" placeholder="Phone (optional)" autoComplete="tel" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Finish"}
        </Button>
      </form>
    </Card>
  );
}
