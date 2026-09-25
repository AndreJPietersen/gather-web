import { authed } from "@/server/api";
import { deleteAccount } from "@/server/services/account";
import { ok } from "@/server/result";

// GET /api/v1/me — who the access token belongs to (also a handy "is my token
// still good?" check for the apps).
export async function GET(request: Request) {
  return authed(request, async (caller) => {
    const { data: profile } = await caller.supabase.from("profiles").select("display_name").eq("id", caller.userId).maybeSingle();
    return ok({ id: caller.userId, email: caller.email, displayName: profile?.display_name ?? null });
  });
}

// DELETE /api/v1/me   body: { "confirm": "DELETE" } — permanently deletes the
// caller's own account (what is erased and what is kept: see delete_account).
export async function DELETE(request: Request) {
  return authed(request, (caller, body) => deleteAccount(caller, body));
}
