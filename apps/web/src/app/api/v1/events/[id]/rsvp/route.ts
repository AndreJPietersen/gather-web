import { open } from "@/server/api";
import { submitGuestRsvp } from "@/server/services/events";

// POST /api/v1/events/{id}/rsvp   (no token — guests have no account)
// body: { name, email, phone?, guestCount }
export async function POST(request: Request, ctx: RouteContext<"/api/v1/events/[id]/rsvp">) {
  const { id } = await ctx.params;
  return open(request, (body) => submitGuestRsvp({ ...(typeof body === "object" && body !== null ? body : {}), eventId: id }), 201);
}
