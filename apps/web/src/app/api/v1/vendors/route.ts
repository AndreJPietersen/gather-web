import { authed } from "@/server/api";
import { registerVendorBusiness } from "@/server/services/vendors";

// POST /api/v1/vendors   body: { name, primaryCategory, description?, phone?, website? }
// 409 "business_rules_blocked" (with details.blocked) when an owner rule
// applies and no approved exception covers it.
export async function POST(request: Request) {
  return authed(request, (caller, body) => registerVendorBusiness(caller, body), 201);
}
