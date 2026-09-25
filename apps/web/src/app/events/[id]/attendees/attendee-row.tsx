"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RsvpToggle } from "./rsvp-toggle";
import { updateAttendeeDetails, type UpdateAttendeeDetailsState } from "./actions";

type RsvpStatus = "attending" | "declined" | "maybe" | "no_response";

const rsvpLabelClasses: Record<RsvpStatus, string> = {
  attending: "bg-success-soft text-ink",
  declined: "bg-primary-soft text-primary",
  maybe: "bg-secondary-soft text-ink",
  no_response: "bg-surface text-text-muted border-2 border-border",
};

interface Attendee {
  id: string;
  name: string | null;
  email: string | null;
  rsvp_status: RsvpStatus;
  guest_count: number;
}

const initialState: UpdateAttendeeDetailsState = {};

// The edit form only ever exists in the DOM while actually editing —
// mounted fresh on every "Edit" tap and unmounted again on Cancel/success —
// so its defaultValue-based inputs never need to react to a value changing
// underneath them the way the notification-preferences bug did. On success,
// router.refresh() re-fetches this row's real attendee prop from the
// server and the component simply falls back to displaying that, rather
// than trying to keep its own parallel copy of the saved values in sync.
export function AttendeeRow({ attendee, eventId, canEdit }: { attendee: Attendee; eventId: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateAttendeeDetails, initialState);
  const router = useRouter();

  // Close the form when a save succeeds. Done during render (React's
  // "adjust state when a value changes" pattern) rather than in the effect,
  // which would call setState synchronously inside an effect. Each action
  // result is a new object, so comparing it to the last one handled fires
  // once per save. The refresh stays in the effect: it's a side effect.
  const [handledState, setHandledState] = useState(state);
  if (state.success && handledState !== state) {
    setHandledState(state);
    setEditing(false);
  }
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (editing) {
    return (
      <Card className="flex flex-col gap-2">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="attendeeId" value={attendee.id} />
          <input type="hidden" name="eventId" value={eventId} />
          <Input name="name" placeholder="Attendee name" required defaultValue={attendee.name ?? ""} />
          <Input name="email" type="email" placeholder="Email (optional)" defaultValue={attendee.email ?? ""} />
          <Field label="Additional guests">
            <Input name="guestCount" type="number" min={0} max={20} defaultValue={attendee.guest_count} className="w-24" />
          </Field>
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
    <Card className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-text">{attendee.name ?? attendee.email ?? "Guest"}</p>
        {attendee.guest_count > 0 && <p className="text-xs font-semibold text-text-muted">+{attendee.guest_count} guest(s)</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canEdit ? (
          <RsvpToggle attendeeId={attendee.id} eventId={eventId} rsvpStatus={attendee.rsvp_status} />
        ) : (
          <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${rsvpLabelClasses[attendee.rsvp_status]}`}>
            {attendee.rsvp_status.replace("_", " ")}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${attendee.name ?? "attendee"}`}
            className="text-xs font-extrabold text-primary"
          >
            Edit
          </button>
        )}
      </div>
    </Card>
  );
}
