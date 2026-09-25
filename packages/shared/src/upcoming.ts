export type UpcomingWindow = "on_day" | "one_day_before" | "one_week_before";

const WINDOW_DAYS: Record<UpcomingWindow, number> = {
  on_day: 0,
  one_day_before: 1,
  one_week_before: 7,
};

// Shared by Home's Upcoming Tasks/Payments sections and My Events' per-event
// pending markers, so both read the same preference the same way — see
// notification_preferences.upcoming_window (Profile's "Show upcoming tasks
// & payments" setting).
export function upcomingWindowDays(window: UpcomingWindow): number {
  return WINDOW_DAYS[window];
}

// Today + the window, as a plain YYYY-MM-DD string — every due_date this
// project stores is a plain `date` column (no time-of-day), so comparing
// against a same-shaped string avoids any timezone-conversion mismatch a
// Date-object comparison could introduce.
export function upcomingCutoffDate(window: UpcomingWindow): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + upcomingWindowDays(window));
  return cutoff.toISOString().slice(0, 10);
}

// installment_status has a real "late" enum value that every display
// branch in this app checks for — but nothing anywhere has ever written it
// (no cron, no trigger); it's permanently "pending" in the database even
// past its due date. Compute overdue-ness live instead of trusting the
// stored status, the same "derive it, don't store a flag nothing
// maintains" fix already applied once in this app (the budget page's
// under/over-budget line). `todayIso` is injectable for tests; defaults to
// the real today the same way getCountdownRemaining's `nowMs` does.
export function isInstallmentOverdue(status: string, dueDate: string, todayIso: string = new Date().toISOString().slice(0, 10)): boolean {
  return status === "pending" && dueDate < todayIso;
}

// The plain, status-less version of the same idea — event_tasks has no
// enum to worry about being stale (just a due_date and a completed
// boolean), so this is just the date comparison on its own, shared so
// task-overdue-ness is computed the same one way everywhere (currently:
// the task reminder check) rather than each call site re-deriving it.
export function isDateOverdue(dueDate: string, todayIso: string = new Date().toISOString().slice(0, 10)): boolean {
  return dueDate < todayIso;
}
