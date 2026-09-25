import type { createClient } from "@/lib/supabase/server";

// Shared by createEvent and updateEvent — not itself a Server Action (no
// "use server" directive here), just a plain helper both of those "use
// server" files import and call directly. Resolves the form's submitted
// eventTypeId ("" | a real uuid | the "other" sentinel) plus eventTypeOther
// into the two columns events actually stores: a real pick does a DB lookup
// rather than trusting the dropdown, both to close the race where an admin
// deactivates a type between page load and submit, and because the lookup
// is needed anyway to get the current name for the denormalized event_type
// text column.
export async function resolveEventType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventTypeId: string,
  eventTypeOther: string,
): Promise<{ error?: string; eventType: string | null; eventTypeId: string | null }> {
  if (eventTypeId === "other") {
    if (!eventTypeOther) {
      return { error: "Please describe the event type.", eventType: null, eventTypeId: null };
    }
    return { eventType: eventTypeOther, eventTypeId: null };
  }

  if (eventTypeId) {
    const { data: type } = await supabase
      .from("event_types")
      .select("id, name")
      .eq("id", eventTypeId)
      .eq("is_active", true)
      .maybeSingle<{ id: string; name: string }>();
    if (!type) {
      return { error: "Please choose a valid event type.", eventType: null, eventTypeId: null };
    }
    return { eventType: type.name, eventTypeId: type.id };
  }

  return { eventType: null, eventTypeId: null };
}
