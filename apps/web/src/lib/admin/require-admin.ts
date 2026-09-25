import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every /admin page and every admin Server Action calls this first,
// unconditionally — a layout gating navigation to a route is not itself a
// security boundary, since a request can always be sent directly (see
// docs/gather_web_architecture.md citing the Next.js Data Security guide).
// notFound() rather than a redirect for a non-admin: an admin route
// shouldn't confirm its own existence to someone probing it.
//
// The RPC call (not a direct `.from("profiles").select("is_admin")`)
// matters: profiles_select_all_authenticated grants full-row SELECT to any
// signed-in or anonymous request, so a plain column read would make "who is
// an admin" queryable by anyone. is_admin() is a SECURITY DEFINER function
// that returns only a boolean, checking *only* the calling user's own row
// (via auth.uid() inside the function body — it takes no argument) — see
// supabase/migrations/00000000000008. An earlier version took an arbitrary
// p_user_id and was granted to anon, which let a caller loop it over every
// profile id and reconstruct the admin roster anyway; found in code review
// and closed by dropping that overload and revoking direct column access
// to is_admin entirely (00000000000009), not just routing through the RPC.
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    notFound();
  }

  return { userId: user.id };
}
