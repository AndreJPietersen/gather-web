import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface VendorAccess {
  isTeamMember: boolean;
  role: "owner" | "manager" | "staff" | null;
}

// Owner > Manager > Staff (see docs/gather_web_architecture.md's Business
// Rules & Invariants): Owner manages the team; Owner/Manager send quotes,
// manage the listing and see money; Staff can chat, add gallery photos,
// keep team notes on bookings and *suggest* quotes for a Manager to send —
// but can't see payment amounts or other quotes' prices.
export async function getVendorAccess(vendorId: string, userId: string | null, client?: SupabaseClient): Promise<VendorAccess> {
  if (!userId) {
    return { isTeamMember: false, role: null };
  }

  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("vendor_team_members")
    .select("role")
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle<{ role: "owner" | "manager" | "staff" }>();

  return { isTeamMember: data !== null, role: data?.role ?? null };
}
