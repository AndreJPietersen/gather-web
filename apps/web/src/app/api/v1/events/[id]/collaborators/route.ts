import { authed } from "@/server/api";
import { inviteCollaborator } from "@/server/services/events";

// POST /api/v1/events/{id}/collaborators   body: { email, permissionLevel: "editor" | "viewer" }
export async function POST(request: Request, ctx: RouteContext<"/api/v1/events/[id]/collaborators">) {
  const { id } = await ctx.params;
  return authed(request, (caller, body) => inviteCollaborator(caller, { ...(typeof body === "object" && body !== null ? body : {}), eventId: id }), 201);
}
