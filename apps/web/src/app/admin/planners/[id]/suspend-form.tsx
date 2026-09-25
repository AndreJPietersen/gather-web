"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suspendUserAction, type SuspendState } from "../../moderation/actions";

const initialState: SuspendState = {};

export function SuspendForm({ userId, listingCount }: { userId: string; listingCount: number }) {
  const [state, formAction, pending] = useActionState(suspendUserAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Input name="reason" placeholder="Reason (kept in the audit log, not shown to them)" />
      {listingCount > 0 && (
        <label className="flex items-center gap-2 text-xs font-bold text-text">
          <input type="checkbox" name="hideListings" defaultChecked />
          Also hide the {listingCount} listing{listingCount === 1 ? "" : "s"} they control
        </label>
      )}
      {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
      {state.message && <p className="text-sm font-semibold text-success">{state.message}</p>}
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {pending ? "Suspending…" : "Suspend account"}
      </Button>
    </form>
  );
}
