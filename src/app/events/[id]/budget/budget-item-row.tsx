"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatZAR } from "@/lib/utils";
import {
  updateBudgetItem,
  removeBudgetItem,
  linkVendorToBudgetItem,
  unlinkVendorFromBudgetItem,
  type BudgetItemFormState,
} from "./actions";

export interface BudgetItem {
  id: string;
  label: string;
  budgeted_amount: string;
  category_id: string | null;
  category_name: string | null;
  event_vendor_id: string | null;
  vendor_name: string | null;
  vendor_confirmed: boolean | null;
  committed_amount: number;
}

const initialState: BudgetItemFormState = {};

// Same inline-edit-toggle shape as attendee-row.tsx's AttendeeRow — the
// edit form only mounts while actually editing, so it never needs to react
// to a value changing underneath an already-mounted uncontrolled input
// (the class of bug the notification-preferences dropdown hit earlier).
export function BudgetItemRow({
  item,
  eventId,
  canEdit,
  categories,
  availableVendors,
}: {
  item: BudgetItem;
  eventId: string;
  canEdit: boolean;
  categories: { id: string; name: string }[];
  availableVendors: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateBudgetItem, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      setEditing(false);
      router.refresh();
    }
  }, [state.success, router]);

  if (editing) {
    return (
      <Card className="flex flex-col gap-2">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="eventId" value={eventId} />
          <Input name="label" placeholder="Line item" required defaultValue={item.label} />
          <Field label="Category (optional)">
            <select
              name="categoryId"
              defaultValue={item.category_id ?? ""}
              className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Input
            name="budgetedAmount"
            type="number"
            step="0.01"
            min={0.01}
            placeholder="Budgeted amount (ZAR)"
            required
            defaultValue={item.budgeted_amount}
          />
          {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{item.label}</p>
          {item.category_name && <p className="text-xs font-semibold text-text-muted">{item.category_name}</p>}
        </div>
        <p className="shrink-0 text-sm font-extrabold text-text">{formatZAR(item.budgeted_amount)}</p>
      </div>

      {item.event_vendor_id ? (
        <div className="flex items-center justify-between gap-2 rounded-field bg-bg px-3 py-2">
          <div className="min-w-0">
            <Link href={`/events/${eventId}/vendors/${item.event_vendor_id}`} className="truncate text-xs font-extrabold">
              {item.vendor_name ?? "Vendor"}
            </Link>
            <p className="text-[11px] font-semibold text-text-muted">
              {item.vendor_confirmed ? "Confirmed" : "Pending"} ·{" "}
              {item.committed_amount > 0 ? (
                `${formatZAR(item.committed_amount)} committed`
              ) : canEdit ? (
                <Link
                  href={`/events/${eventId}/payments?vendor=${item.event_vendor_id}&budgetItem=${item.id}`}
                  className="text-primary underline"
                >
                  Create a payment plan
                </Link>
              ) : (
                "No payment plan yet"
              )}
            </p>
          </div>
          {canEdit && (
            <form action={unlinkVendorFromBudgetItem}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <button type="submit" className="shrink-0 text-[11px] font-extrabold text-primary">
                Unlink
              </button>
            </form>
          )}
        </div>
      ) : (
        canEdit &&
        availableVendors.length > 0 && (
          <form action={linkVendorToBudgetItem} className="flex items-center gap-2">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="eventId" value={eventId} />
            <select
              name="eventVendorId"
              required
              className="min-w-0 flex-1 rounded-field border-2 border-border bg-surface px-2 py-1.5 text-xs font-bold text-text"
            >
              <option value="">Link a vendor…</option>
              {availableVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Link
            </Button>
          </form>
        )
      )}

      {canEdit && (
        <div className="flex gap-3 text-xs font-extrabold">
          <button type="button" onClick={() => setEditing(true)} className="text-primary">
            Edit
          </button>
          <form action={removeBudgetItem}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="eventId" value={eventId} />
            <button type="submit" className="text-primary">
              Remove
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}
