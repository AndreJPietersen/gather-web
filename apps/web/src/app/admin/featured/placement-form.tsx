"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { savePlacement, type PlacementFormState } from "./actions";

export interface PlacementFormValues {
  placementId?: string;
  vendorId?: string;
  startsOn?: string;
  endsOn?: string;
  position?: number | null;
  status?: "pending" | "activated";
  feeAmount?: string | null;
  note?: string | null;
}

const initialState: PlacementFormState = {};

const selectClasses =
  "w-full rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text";

// Used for both "new" and "edit" — a hidden placementId is what tells the
// action which one it is. The vendor can't be changed on an existing
// placement (that would really be a different placement), so it renders as a
// fixed name plus a hidden id instead of a dropdown when editing.
export function PlacementForm({
  vendors,
  values = {},
}: {
  vendors: { id: string; name: string }[];
  values?: PlacementFormValues;
}) {
  const [state, formAction, pending] = useActionState(savePlacement, initialState);
  const isEdit = Boolean(values.placementId);
  const vendorName = vendors.find((v) => v.id === values.vendorId)?.name;

  return (
    <Card className="max-w-lg">
      <form action={formAction} className="flex flex-col gap-4">
        {values.placementId && <input type="hidden" name="placementId" value={values.placementId} />}

        {isEdit ? (
          <>
            <input type="hidden" name="vendorId" value={values.vendorId} />
            <Field label="Vendor">
              <p className="rounded-field border-2 border-border bg-bg px-[13px] py-[13px] text-sm font-bold text-text">
                {vendorName ?? "Unknown vendor"}
              </p>
            </Field>
          </>
        ) : (
          <Field label="Vendor">
            <select name="vendorId" required defaultValue={values.vendorId ?? ""} className={selectClasses}>
              <option value="" disabled>
                Choose a vendor…
              </option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input name="startsOn" type="date" required defaultValue={values.startsOn} />
          </Field>
          <Field label="Ends (inclusive)">
            <Input name="endsOn" type="date" required defaultValue={values.endsOn} />
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <Field label="Position (optional)">
            <Input name="position" type="number" min={1} max={50} placeholder="Blank = rotating" defaultValue={values.position ?? ""} className="w-52" />
          </Field>
          <p className="text-xs font-semibold text-text-muted">
            1 puts this vendor first among featured vendors, 2 second, and so on. Leave it blank to put the vendor in
            the rotating pool, which shuffles fairly each day.
          </p>
        </div>

        <Field label="Status">
          <select name="status" defaultValue={values.status ?? "pending"} className={selectClasses}>
            <option value="pending">Pending — not shown until activated</option>
            <option value="activated">Activated — shown between the dates</option>
          </select>
        </Field>

        <Field label="Fee (internal, optional)">
          <CurrencyInput name="feeAmount" defaultValue={values.feeAmount ?? undefined} placeholder="Amount paid (ZAR)" />
        </Field>

        <Field label="Note (internal, optional)">
          <textarea
            name="note"
            rows={3}
            maxLength={500}
            defaultValue={values.note ?? ""}
            placeholder="Invoice number, who agreed it, anything worth remembering"
            className={selectClasses}
          />
        </Field>

        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}

        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create placement"}
        </Button>
      </form>
    </Card>
  );
}
