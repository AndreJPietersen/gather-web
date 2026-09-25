"use client";

import { useState, useTransition } from "react";
import { Check, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/lib/stores/toast-store";
import { updateAttendeeRsvp } from "./actions";

type RsvpStatus = "attending" | "declined" | "maybe" | "no_response";
type TappableStatus = Exclude<RsvpStatus, "no_response">;

const OPTIONS: { value: TappableStatus; icon: typeof Check; label: string; activeClass: string }[] = [
  { value: "attending", icon: Check, label: "Attending", activeClass: "bg-success-soft text-ink" },
  { value: "maybe", icon: HelpCircle, label: "Maybe", activeClass: "bg-secondary-soft text-ink" },
  { value: "declined", icon: X, label: "Declined", activeClass: "bg-primary-soft text-primary" },
];

// Replaces the previous native <select> — it read as a big, all-caps,
// browser-chrome-heavy control sitting oddly next to a plain text "Edit"
// link, out of step with every other compact pill/icon control on this
// page. "No response" isn't its own tappable option here — it's simply
// what showing with nothing pressed already means, matching how the
// question was actually framed: 3 direct-tap icons, not a 4-option menu.
// Tapping the currently active icon again clears it back to "no response",
// so this fully replaces the select rather than needing a separate way to
// un-RSVP someone.
//
// Same controlled-state-plus-transition shape as the select it replaces,
// for the same reason: reverting on a failed write needs to read the
// action's actual result, which an uncontrolled element (or a plain <form
// action>) can't do.
export function RsvpToggle({
  attendeeId,
  eventId,
  rsvpStatus,
}: {
  attendeeId: string;
  eventId: string;
  rsvpStatus: RsvpStatus;
}) {
  const [value, setValue] = useState<RsvpStatus>(rsvpStatus);
  const [isPending, startTransition] = useTransition();
  const addToast = useToastStore((s) => s.addToast);

  function handleTap(option: TappableStatus) {
    const previous = value;
    const next: RsvpStatus = value === option ? "no_response" : option;
    setValue(next);

    const formData = new FormData();
    formData.set("attendeeId", attendeeId);
    formData.set("eventId", eventId);
    formData.set("rsvpStatus", next);

    startTransition(async () => {
      const result = await updateAttendeeRsvp(formData);
      if (result.error) {
        setValue(previous);
        addToast({ message: result.error, variant: "error" });
      }
    });
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="RSVP status">
      {OPTIONS.map(({ value: optionValue, icon: Icon, label, activeClass }) => {
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            disabled={isPending}
            onClick={() => handleTap(optionValue)}
            aria-pressed={isActive}
            aria-label={label}
            title={label}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60",
              isActive ? activeClass : "border-2 border-border bg-surface text-text-muted",
            )}
          >
            <Icon size={14} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}
