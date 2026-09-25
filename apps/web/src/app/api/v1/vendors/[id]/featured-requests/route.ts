import { authed } from "@/server/api";
import { requestFeaturedPlacement } from "@/server/services/featured";

// POST /api/v1/vendors/{id}/featured-requests   (business owner only)
// body: { spot: "top" | "rotating", duration: "1_week" | "1_month" | "3_months", startsOn: "YYYY-MM-DD", vendorNote? }
export async function POST(request: Request, ctx: RouteContext<"/api/v1/vendors/[id]/featured-requests">) {
  const { id } = await ctx.params;
  return authed(request, (caller, body) => requestFeaturedPlacement(caller, { ...(typeof body === "object" && body !== null ? body : {}), vendorId: id }), 201);
}
