"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addService, type ServiceFormState } from "./actions";

const initialState: ServiceFormState = {};

export function AddServiceForm({ vendorId }: { vendorId: string }) {
  const [state, formAction, pending] = useActionState(addService, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <Input name="name" placeholder="Service name (e.g. Wedding package)" required />
        <Input name="description" placeholder="Description (optional)" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add listing"}
        </Button>
      </form>
    </Card>
  );
}
