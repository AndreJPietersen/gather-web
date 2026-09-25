import type { createClient } from "@/lib/supabase/server";
import type { UpcomingWindow } from "@gather/shared/upcoming";

// The pure upcoming/overdue logic lives in @gather/shared (the native app
// uses it too); re-exported so existing imports keep working. Only the
// database read stays here.
export * from "@gather/shared/upcoming";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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
