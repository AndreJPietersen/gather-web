import { authed } from "@/server/api";
import { updateVendorBusiness } from "@/server/services/vendors";

// PATCH /api/v1/vendors/{id}   body: { name, primaryCategory?, description?, phone?, website? }
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/vendors/[id]">) {
  const { id } = await ctx.params;
  return authed(request, (caller, body) => updateVendorBusiness(caller, { ...(typeof body === "object" && body !== null ? body : {}), vendorId: id }));
}
