"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
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
  categories: string[];
}

export function EditVendorForm({ vendorId, name, primaryCategory, description, phone, website, categories }: EditVendorFormProps) {
  const [state, formAction, pending] = useActionState(updateVendorBusiness, initialState);
  // A business created before categories became a fixed list may have a
  // free-text one that isn't on it — keep it selectable so saving other
  // fields doesn't silently change it.
  const options = primaryCategory && !categories.includes(primaryCategory) ? [primaryCategory, ...categories] : categories;

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <Input name="name" placeholder="Business name" required defaultValue={name} />
        <Field label="Category">
          <select
            name="primaryCategory"
            defaultValue={primaryCategory}
            className="w-full rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="">No category</option>
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
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
