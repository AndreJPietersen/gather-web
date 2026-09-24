"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveBookingNote, type BookingNoteState } from "../actions";

const initialState: BookingNoteState = {};

// The vendor team's private note on one booking — only the team sees it.
export function BookingNoteForm({
  eventVendorId,
  vendorId,
  body,
  lastEditedBy,
}: {
  eventVendorId: string;
  vendorId: string;
  body: string;
  lastEditedBy: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveBookingNote, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-1.5 border-t-2 border-border pt-2">
      <input type="hidden" name="eventVendorId" value={eventVendorId} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <label className="flex flex-col gap-1 text-xs font-extrabold text-text-muted">
        Team notes (only your team sees these)
        <textarea
          name="body"
          rows={2}
          maxLength={2000}
          defaultValue={body}
          placeholder="e.g. arrive 2pm, gate code 4411"
          className="w-full rounded-field border-2 border-border bg-surface px-3 py-2 text-sm font-bold text-text"
        />
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" disabled={pending} className="px-4 py-1.5 text-xs">
          {pending ? "Saving…" : "Save note"}
        </Button>
        {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
        {state.saved && !pending && <p className="text-xs font-semibold text-success">Saved.</p>}
        {!state.saved && lastEditedBy && <p className="text-[11px] font-semibold text-text-muted">Last edited by {lastEditedBy}</p>}
      </div>
    </form>
  );
}
