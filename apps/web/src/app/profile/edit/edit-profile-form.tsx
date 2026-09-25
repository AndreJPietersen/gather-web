"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateProfile, type EditProfileState } from "./actions";

const initialState: EditProfileState = {};

export function EditProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Input name="name" placeholder="Your name" required autoComplete="name" defaultValue={name} />
        <Input name="phone" type="tel" placeholder="Phone (optional)" autoComplete="tel" defaultValue={phone} />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </Card>
  );
}
