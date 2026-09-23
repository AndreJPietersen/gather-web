"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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
  accepted_quote_amount: number | null;
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
  // Own useActionState per action, not a shared one — each button needs its
  // own pending/error state, and unlike updateBudgetItem these two don't
  // toggle `editing`, so they can't just reuse its state.
  const [unlinkState, unlinkAction, unlinkPending] = useActionState(unlinkVendorFromBudgetItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeBudgetItem, initialState);
  const router = useRouter();
  // committed_amount is the sum of the linked vendor's payment plan
  // total(s) — the full agreed cost, not a running "paid so far" (that's
  // what payment_installments tracks separately) — so a gap below the
  // budgeted amount here means the vendor simply came in cheaper than
  // planned, not that more payment is still owed on top of it. Only
  // meaningful once something's actually committed (a fully-uncommitted
  // line already says so via "Create a payment plan"/"No payment plan yet"
  // below).
  const budgetGap = Number(item.budgeted_amount) - item.committed_amount;
  const quoteMismatch =
    item.accepted_quote_amount !== null && Math.abs(item.accepted_quote_amount - item.committed_amount) > 0.01
      ? item.accepted_quote_amount
      : null;

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
          <CurrencyInput name="budgetedAmount" placeholder="Budgeted amount (ZAR)" required defaultValue={item.budgeted_amount} />
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
        <div className="shrink-0 text-right">
          <p className="text-sm font-extrabold text-text">{formatZAR(item.budgeted_amount)}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Budgeted</p>
        </div>
      </div>

      {item.event_vendor_id ? (
        // items-start, not items-center: the committed/still-needed line can
        // now wrap to two lines, and centering "Unlink" against that taller
        // block made it visually drift into the wrapped second line instead
        // of sitting clearly next to the vendor name at the top.
        <div className="flex items-start justify-between gap-2 rounded-field bg-bg px-3 py-2">
          <div className="min-w-0">
            <Link href={`/events/${eventId}/vendors/${item.event_vendor_id}`} className="truncate text-xs font-extrabold">
              {item.vendor_name ?? "Vendor"}
            </Link>
            <p className="text-[11px] font-semibold text-text-muted">
              {item.vendor_confirmed ? "Confirmed" : "Pending"} ·{" "}
              {item.committed_amount > 0 ? (
                <>
                  {formatZAR(item.committed_amount)} committed
                  {budgetGap > 0.01 && (
                    <span className="text-success"> · {formatZAR(budgetGap)} under budget</span>
                  )}
                  {budgetGap < -0.01 && (
                    <span className="text-primary"> · {formatZAR(Math.abs(budgetGap))} over budget</span>
                  )}
                </>
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
            {quoteMismatch !== null && (
              <p className="mt-0.5 text-[10px] font-semibold text-primary">
                Accepted quote was {formatZAR(quoteMismatch)} — the payment plan total is what counts here, not the quote.
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <form action={unlinkAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <button type="submit" disabled={unlinkPending} className="text-[11px] font-extrabold text-primary">
                  {unlinkPending ? "Unlinking…" : "Unlink"}
                </button>
              </form>
              {unlinkState.error && <p className="max-w-[140px] text-right text-[10px] font-semibold text-primary">{unlinkState.error}</p>}
            </div>
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
              className="min-w-0 flex-1 rounded-field border-2 border-border bg-surface px-2 py-2 text-xs font-bold text-text"
            >
              <option value="">Link a vendor…</option>
              {availableVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" className="px-4 py-2 text-xs">
              Link
            </Button>
          </form>
        )
      )}

      {canEdit && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-3 text-xs font-extrabold">
            <button type="button" onClick={() => setEditing(true)} className="text-primary">
              Edit
            </button>
            <form action={removeAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <button type="submit" disabled={removePending} className="text-primary">
                {removePending ? "Removing…" : "Remove"}
              </button>
            </form>
          </div>
          {removeState.error && <p className="text-xs font-semibold text-primary">{removeState.error}</p>}
        </div>
      )}
    </Card>
  );
}
