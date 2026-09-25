import { authed } from "@/server/api";
import { requestBusinessException } from "@/server/services/vendors";

// POST /api/v1/business-requests   body: { name, primaryCategory, reason }
export async function POST(request: Request) {
  return authed(request, (caller, body) => requestBusinessException(caller, body), 201);
}
