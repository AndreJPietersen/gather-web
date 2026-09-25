"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createStubVendor, type CreateStubState } from "./actions";

const initialState: CreateStubState = {};

export function CreateStubForm({ prefillName }: { prefillName?: string }) {
  const [state, formAction, pending] = useActionState(createStubVendor, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Input name="name" placeholder="Business name" required defaultValue={prefillName} />
        <Input name="primaryCategory" placeholder="Category (e.g. Florals)" />
        <Input name="phone" type="tel" placeholder="Phone (optional)" />
        <Input name="website" type="url" placeholder="Website (optional)" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Creating…" : "Add this vendor"}
        </Button>
      </form>
    </Card>
  );
}
