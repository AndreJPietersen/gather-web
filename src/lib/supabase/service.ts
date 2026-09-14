import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Server-only: never import
 * this from a Client Component, and never return its query results to the
 * client unshaped.
 *
 * Used only for the guest RSVP write, and only after independently
 * re-checking (with the request-scoped, RLS-respecting client) that the
 * target row is actually one a guest is allowed to act on — this client
 * itself enforces nothing, so every call site is responsible for its own
 * narrow, explicit check first. This is the direct port of the Salesforce
 * build's `GuestSubmissionController` pattern: a narrow allow-listed DTO,
 * not raw table access, per docs/gather_web_architecture.md's Authorization
 * Model Port.
 */
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolves an email to an existing user's id + display name, for inviting a
 * collaborator by email (`event_collaborators` only stores a `user_id`, no
 * email-invite bridge table like `vendor_team_invites` has for vendors —
 * the invitee must already have an account).
 *
 * Deliberately does NOT add an `email` column to `public.profiles` to make
 * this lookup possible: that table's `profiles_select_all_authenticated`
 * policy grants any signed-in (or anonymous) request full-row SELECT, so
 * any column added there is effectively public — fine for `display_name`,
 * not for an email address. Instead this queries Supabase Auth's admin API
 * directly (protected, service-role only, never exposed via PostgREST)
 * and returns only the two fields the invite UI actually needs.
 */
export async function findUserByEmail(email: string): Promise<{ id: string; displayName: string | null } | null> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  // GoTrue's admin `filter` param is a substring match, not exact — confirm
  // an exact (case-insensitive) match ourselves rather than trusting it.
  const { users } = (await res.json()) as { users: { id: string; email?: string }[] };
  const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!match) {
    return null;
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient.from("profiles").select("display_name").eq("id", match.id).maybeSingle();

  return { id: match.id, displayName: profile?.display_name ?? null };
}
