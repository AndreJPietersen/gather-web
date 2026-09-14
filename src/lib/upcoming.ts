import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

// Defaults to the same "one_week_before" the DB column defaults to when no
// row exists yet (mirrors profile/page.tsx's own fallback) — a new user
// shouldn't see an empty Upcoming section just because they've never opened
// Profile's settings.
export async function getUpcomingWindow(supabase: SupabaseServerClient, userId: string): Promise<UpcomingWindow> {
  const { data } = await supabase
    .from("notification_preferences")
    .select("upcoming_window")
    .eq("profile_id", userId)
    .maybeSingle();

  return data?.upcoming_window ?? "one_week_before";
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
