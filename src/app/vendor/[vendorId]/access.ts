import { createClient } from "@/lib/supabase/server";

export interface VendorAccess {
  isTeamMember: boolean;
  role: "owner" | "manager" | "staff" | null;
}

// Owner > Manager > Staff (see docs/gather_web_architecture.md's Business
// Rules & Invariants): Owner manages the team, Owner/Manager quote and
// manage listings, Staff is view-only on bookings/quotes.
export async function getVendorAccess(vendorId: string, userId: string | null): Promise<VendorAccess> {
  if (!userId) {
    return { isTeamMember: false, role: null };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_team_members")
    .select("role")
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle<{ role: "owner" | "manager" | "staff" }>();

  return { isTeamMember: data !== null, role: data?.role ?? null };
}
