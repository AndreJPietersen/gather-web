"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { inviteCollaborator, type InviteCollaboratorState } from "./actions";

const initialState: InviteCollaboratorState = {};

export function InviteCollaboratorForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(inviteCollaborator, initialState);

  if (state.success) {
    return (
      <Card>
        <p className="text-sm font-bold text-text">Invited. They&apos;ll see it next time they log in.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <Input name="email" type="email" placeholder="Collaborator's email" required />
        <select
          name="permissionLevel"
          defaultValue="viewer"
          className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </form>
    </Card>
  );
}
