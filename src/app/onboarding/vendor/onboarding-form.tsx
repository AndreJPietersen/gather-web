"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { registerVendorBusiness, type VendorOnboardingState } from "./actions";

const initialState: VendorOnboardingState = {};

export function VendorOnboardingForm() {
  const [state, formAction, pending] = useActionState(registerVendorBusiness, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Input name="name" placeholder="Business name" required />
        <Input name="primaryCategory" placeholder="Category (e.g. Florals)" />
        <Input name="description" placeholder="Short description" />
        <Input name="phone" type="tel" placeholder="Phone (optional)" />
        <Input name="website" type="url" placeholder="Website (optional)" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create business"}
        </Button>
      </form>
    </Card>
  );
}
