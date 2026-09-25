import { createClient } from "@/lib/supabase/server";
import type { vendorTeamMembers, vendors } from "@gather/db/schema";

export type VendorRole = (typeof vendorTeamMembers.$inferSelect)["role"];

export type Persona = { type: "planner" } | { type: "vendor"; vendorId: string; vendorName: string; role: VendorRole };

export type SessionContext =
  | { status: "guest" }
  | {
      status: "authenticated";
      userId: string;
      displayName: string | null;
      personas: Persona[];
    };

interface VendorMembershipRow {
  role: VendorRole;
  vendors: Pick<typeof vendors.$inferSelect, "id" | "name"> | null;
}

/**
 * Reads the current request's Supabase Auth session and, if signed in, every
 * active persona the user can act as (their own Planner identity, plus one
 * per vendor business they're an active team member of).
 *
 * Call this fresh wherever session state is needed (the direct replacement
 * for the Salesforce build's `SessionContextController.getSessionContext`)
 * rather than caching it — the whole point of reading it this way, instead
 * of a one-shot publish at shell-mount, is to avoid the documented
 * "late subscriber never gets the initial publish" bug that pattern had.
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "guest" };
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase
      .from("vendor_team_members")
      .select("role, vendors(id, name)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .returns<VendorMembershipRow[]>(),
  ]);

  const personas: Persona[] = [
    { type: "planner" },
    ...(memberships ?? [])
      .filter((m) => m.vendors !== null)
      .map((m) => ({
        type: "vendor" as const,
        vendorId: m.vendors!.id,
        vendorName: m.vendors!.name,
        role: m.role,
      })),
  ];

  return {
    status: "authenticated",
    userId: user.id,
    displayName: profile?.display_name ?? null,
    personas,
  };
}
