"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdvanceOnSuccess } from "@/lib/hooks/use-advance-on-success";
import { saveMoodBoardTagline, type MoodBoardTaglineState } from "./actions";

const initialState: MoodBoardTaglineState = {};

// Display and edit share one component (unlike a plain always-visible
// form) since only an editor with an existing tagline needs the toggle at
// all — no tagline yet, or no write access, each have exactly one thing to
// show. Starts in edit mode when there's nothing saved yet (an empty board
// has no styled text worth displaying), display mode otherwise; a
// successful save flips back to display automatically rather than leaving
// the form open on top of its own result.
export function TaglineForm({ eventId, defaultValue }: { eventId: string; defaultValue: string | null }) {
  const [editing, setEditing] = useState(!defaultValue);
  const [state, formAction, pending] = useActionState(saveMoodBoardTagline, initialState);
  useAdvanceOnSuccess(state, pending, () => setEditing(false));

  if (!editing && defaultValue) {
    return (
      <div className="flex items-center justify-center gap-2">
        <div className="relative">
          <span className="relative z-10 font-display text-lg font-semibold italic text-ink">{defaultValue}</span>
          <svg
            aria-hidden
            viewBox="0 0 200 15"
            className="pointer-events-none absolute left-1/2 top-[62%] h-[15px] w-[190px] -translate-x-1/2"
            preserveAspectRatio="none"
          >
            <path d="M4,9 C55,3 145,13 196,6" stroke="var(--color-secondary)" strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.9" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit tagline"
          className="shrink-0 rounded-pill p-1.5 text-text-muted hover:bg-primary-soft hover:text-primary"
        >
          <Pencil size={15} strokeWidth={2.2} />
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex items-center gap-2">
        <Input name="tagline" placeholder="A short caption for your board" defaultValue={defaultValue ?? ""} maxLength={120} className="flex-1" />
        <Button type="submit" variant="accent" disabled={pending} className="px-4 py-3 text-xs">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
    </form>
  );
}
