"use client";

import { useActionState, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useAdvanceOnSuccess } from "@/lib/hooks/use-advance-on-success";
import { removeMoodBoardColor, updateMoodBoardColor, type MoodBoardColorState } from "./actions";

const initialState: MoodBoardColorState = {};

// Tapping an existing swatch opens an edit modal instead of removing it
// outright — "Change color" reuses the same auto-submit-on-pick native
// input as adding a new one, just replacing this entry; "Remove" lives
// inside the same modal as its own explicit action, rather than the
// swatch itself being a one-tap delete button.
export function PaletteSwatch({ eventId, color }: { eventId: string; color: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateMoodBoardColor, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useAdvanceOnSuccess(state, pending, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${color}`}
        className="h-9 w-9 rounded-[50%_50%_50%_4px] border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
        style={{ backgroundColor: color }}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Edit color">
        <div className="flex flex-col items-center gap-4">
          <form ref={formRef} action={formAction} className="flex flex-col items-center gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="oldColor" value={color} />
            <span
              className="h-16 w-16 rounded-[50%_50%_50%_10px] border-4 border-white shadow-[0_4px_10px_rgba(0,0,0,0.2)]"
              style={{ backgroundColor: color }}
            />
            <label className="relative cursor-pointer rounded-pill border-2 border-border bg-surface px-5 py-2.5 text-sm font-extrabold text-text">
              {pending ? "Saving…" : "Change color"}
              <input
                type="color"
                name="newColor"
                defaultValue={color}
                disabled={pending}
                onChange={() => formRef.current?.requestSubmit()}
                aria-label="Pick a new color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
            </label>
            {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
          </form>
          <form action={removeMoodBoardColor}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="color" value={color} />
            <button type="submit" className="text-sm font-extrabold text-primary">
              Remove this color
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}
