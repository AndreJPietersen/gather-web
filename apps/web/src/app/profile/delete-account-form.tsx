"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteMyAccount, type DeleteAccountState } from "./actions";

const initialState: DeleteAccountState = {};

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteMyAccount, initialState);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-extrabold text-primary marker:content-none">Delete my account</summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <ul className="list-disc pl-5 text-xs font-semibold text-text-muted">
          <li>Your events, guest lists, tasks and budgets are deleted.</li>
          <li>You leave every business team. A business with no one left on it is hidden.</li>
          <li>Messages and other things you wrote for other people stay, shown as &quot;Deleted user&quot;.</li>
          <li>This can&apos;t be undone.</li>
        </ul>
        <Input name="confirm" placeholder="Type DELETE to confirm" autoComplete="off" required />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Deleting…" : "Permanently delete my account"}
        </Button>
      </form>
    </details>
  );
}
