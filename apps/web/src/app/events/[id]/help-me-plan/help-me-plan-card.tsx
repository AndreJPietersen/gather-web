"use client";

import { useState } from "react";
import { HelpMePlanWizard } from "./help-me-plan-wizard";
import type { EventPlanningProgressResult } from "@gather/shared/event-planning-progress";

// Always visible on the event page regardless of progress (Andre's call) —
// unlike the vendor side's ProfileCompletionCard, this doesn't disappear
// once everything's done, since reopening it to add a second vendor or
// another task is a normal thing to want later, not just first-time setup.
export function HelpMePlanCard({
  eventId,
  progress,
  budgetCategories,
  suggestedVendors,
  initialBudgetItems,
  initialEventVendor,
}: {
  eventId: string;
  progress: EventPlanningProgressResult;
  budgetCategories: { id: string; name: string }[];
  suggestedVendors: { id: string; name: string; primary_category: string | null }[];
  initialBudgetItems: { id: string; label: string }[];
  initialEventVendor: { id: string; name: string } | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-[18px] bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] p-4 text-left text-white shadow-[0_8px_20px_-10px_var(--color-primary)]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white/20 text-base">✦</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold">Help me plan</span>
          <span className="mt-0.5 block text-[11px] font-bold text-white/85">
            A few simple steps to get everything sorted.
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-85"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      <HelpMePlanWizard
        open={open}
        onClose={() => setOpen(false)}
        eventId={eventId}
        progress={progress}
        budgetCategories={budgetCategories}
        suggestedVendors={suggestedVendors}
        initialBudgetItems={initialBudgetItems}
        initialEventVendor={initialEventVendor}
      />
    </>
  );
}
