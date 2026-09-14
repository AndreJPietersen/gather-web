"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signUp, type SignUpState } from "./actions";

const initialState: SignUpState = {};

export function RegisterForm({ persona }: { persona: "planner" | "vendor" }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="persona" value={persona} />
        <Input type="email" name="email" placeholder="Email" required autoComplete="email" />
        <Input type="password" name="password" placeholder="Password" required autoComplete="new-password" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
