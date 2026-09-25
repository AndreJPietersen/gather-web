// The planner-side twin of vendor-completion.ts's getVendorCompletion() —
// same shape, same reasoning: computed live from real counts every call,
// never a stored flag, so it can't drift the way installment_status's dead
// "late" value once did. Drives the "Help me plan" entry card and wizard on
// the event detail page (src/app/events/[id]/help-me-plan/).
export interface EventPlanningProgressInput {
  attendeeCount: number;
  taskCount: number;
  budgetItemCount: number;
  vendorCount: number;
  paymentPlanCount: number;
}

export type EventPlanningStepKey = "attendees" | "tasks" | "budget" | "vendor" | "payments";

export interface EventPlanningProgressItem {
  key: EventPlanningStepKey;
  label: string;
  done: boolean;
}

export interface EventPlanningProgressResult {
  doneCount: number;
  totalCount: number;
  percent: number;
  items: EventPlanningProgressItem[];
}

export function getEventPlanningProgress(input: EventPlanningProgressInput): EventPlanningProgressResult {
  const items: EventPlanningProgressItem[] = [
    { key: "attendees", label: "Add an attendee", done: input.attendeeCount > 0 },
    { key: "tasks", label: "Add a task", done: input.taskCount > 0 },
    { key: "budget", label: "Add a budget item", done: input.budgetItemCount > 0 },
    { key: "vendor", label: "Add a vendor", done: input.vendorCount > 0 },
    { key: "payments", label: "Set up a payment plan", done: input.paymentPlanCount > 0 },
  ];

  const doneCount = items.filter((item) => item.done).length;
  return {
    doneCount,
    totalCount: items.length,
    percent: Math.round((doneCount / items.length) * 100),
    items,
  };
}
