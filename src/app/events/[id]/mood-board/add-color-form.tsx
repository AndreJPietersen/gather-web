"use client";

import { useActionState, useRef } from "react";
import { addMoodBoardColor, type MoodBoardColorState } from "./actions";

const initialState: MoodBoardColorState = {};
const DEFAULT_PICK = "#c98a4b";

// Auto-submits on pick rather than needing a separate "Add" tap — picking
// a color already means "add this one," and a second explicit tap is an
// easy step to lose track of on a phone (the color input's value only
// updates on the OS picker's own "Set," so a follow-up tap has to land on
// the right target after that sheet closes). requestSubmit() fires from
// inside the same onChange, so there's no gap between picking a color and
// it actually reaching the server action.
export function AddColorForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(addMoodBoardColor, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const hiddenColorRef = useRef<HTMLInputElement>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    if (hiddenColorRef.current) {
      hiddenColorRef.current.value = e.target.value;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="color" ref={hiddenColorRef} defaultValue={DEFAULT_PICK} />
      <label
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border text-sm font-bold text-text-muted ${pending ? "opacity-50" : "cursor-pointer"}`}
      >
        +
        <input
          type="color"
          defaultValue={DEFAULT_PICK}
          onChange={handlePick}
          disabled={pending}
          aria-label="Choose a color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </label>
      {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
    </form>
  );
}
