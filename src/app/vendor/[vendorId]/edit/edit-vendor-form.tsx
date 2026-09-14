"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateVendorBusiness, type EditVendorState } from "./actions";

const initialState: EditVendorState = {};

interface EditVendorFormProps {
  vendorId: string;
  name: string;
  primaryCategory: string;
  description: string;
  phone: string;
  website: string;
}

export function EditVendorForm({ vendorId, name, primaryCategory, description, phone, website }: EditVendorFormProps) {
  const [state, formAction, pending] = useActionState(updateVendorBusiness, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <Input name="name" placeholder="Business name" required defaultValue={name} />
        <Input name="primaryCategory" placeholder="Category (e.g. Florals)" defaultValue={primaryCategory} />
        <Input name="description" placeholder="Short description" defaultValue={description} />
        <Input name="phone" type="tel" placeholder="Phone (optional)" defaultValue={phone} />
        <Input name="website" type="url" placeholder="Website (optional)" defaultValue={website} />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </Card>
  );
}
