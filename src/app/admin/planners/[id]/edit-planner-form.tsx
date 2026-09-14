"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToastStore } from "@/lib/stores/toast-store";
import { editPlanner, type EditPlannerState } from "./actions";

const initialState: EditPlannerState = {};

export function EditPlannerForm({
  profileId,
  displayName,
  phone,
}: {
  profileId: string;
  displayName: string | null;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(editPlanner, initialState);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (state.success) {
      addToast({ message: "Profile updated.", variant: "success" });
    }
  }, [state.success, addToast]);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="profileId" value={profileId} />
        <Field label="Display name">
          <Input name="displayName" defaultValue={displayName ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={phone ?? ""} />
        </Field>
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending} className="w-fit">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
