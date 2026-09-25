import { authed } from "@/server/api";
import { withdrawFeaturedRequest } from "@/server/services/featured";

// DELETE /api/v1/vendors/{id}/featured-requests/{placementId}   (owner; pending requests only)
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/vendors/[id]/featured-requests/[placementId]">) {
  const { id, placementId } = await ctx.params;
  return authed(request, (caller) => withdrawFeaturedRequest(caller, { vendorId: id, placementId }));
}
