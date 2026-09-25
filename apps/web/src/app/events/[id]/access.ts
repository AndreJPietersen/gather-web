import { createClient } from "@/lib/supabase/server";

export interface EventAccess {
  isOwner: boolean;
  isEditor: boolean;
  isCollaborator: boolean;
}

/**
 * The event's own SELECT policy (events_select_owner_or_collaborator, plus
 * the public one) lets a Viewer-permission collaborator — or a guest, on a
 * public event — load the same row an owner would, so pages need this
 * separate check to decide what to *show* (an Edit button, an add-attendee
 * form) beyond what RLS alone gates for writes. Mirrors what the update
 * policy actually requires: owner, or an accepted Editor collaborator.
 */
export async function getEventAccess(eventId: string, ownerId: string, userId: string | null): Promise<EventAccess> {
  if (!userId) {
    return { isOwner: false, isEditor: false, isCollaborator: false };
  }

  if (ownerId === userId) {
    return { isOwner: true, isEditor: true, isCollaborator: false };
  }

  const supabase = await createClient();
  const { data: collaboration } = await supabase
    .from("event_collaborators")
    .select("permission_level")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  return {
    isOwner: false,
    isEditor: collaboration?.permission_level === "editor",
    isCollaborator: collaboration !== null,
  };
}
