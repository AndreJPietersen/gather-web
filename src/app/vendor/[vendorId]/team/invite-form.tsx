"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inviteTeamMember, type InviteTeamMemberState } from "./actions";

const initialState: InviteTeamMemberState = {};

export function InviteForm({ vendorId }: { vendorId: string }) {
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);

  if (state.success) {
    return (
      <Card>
        <p className="text-sm font-bold text-text">Invited. They&apos;ll see it once they log in.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <Input name="email" type="email" placeholder="Teammate's email" required />
        <Field label="Role">
          <select
            name="role"
            defaultValue="staff"
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
        </Field>
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </form>
    </Card>
  );
}
