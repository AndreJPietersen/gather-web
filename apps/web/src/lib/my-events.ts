import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// The "which events am I really part of" union — owner, plus any accepted
// collaborator — computed the same way in more than one place now
// (checkAndSendPaymentReminders, checkAndSendTaskReminders), so it's a
// shared helper rather than a second copy-pasted version. `minRole`
// narrows the collaborator half to editors only, matching whichever
// resource's own write posture the caller cares about (payment reminders
// need editor, since payment_installments' own write policy is editor-only;
// task reminders don't, since event_tasks is visible — and a task can be
// due on you — as any collaborator, not just an editor).
export async function getMyEventIds(
  supabase: SupabaseServerClient,
  userId: string,
  minRole?: "editor",
): Promise<Set<string>> {
  const { data: ownedEvents } = await supabase.from("events").select("id").eq("owner_id", userId);

  let collabQuery = supabase.from("event_collaborators").select("event_id").eq("user_id", userId).eq("status", "accepted");
  if (minRole === "editor") {
    collabQuery = collabQuery.eq("permission_level", "editor");
  }
  const { data: collabEvents } = await collabQuery;

  return new Set<string>([...(ownedEvents ?? []).map((e) => e.id), ...(collabEvents ?? []).map((c) => c.event_id)]);
}
