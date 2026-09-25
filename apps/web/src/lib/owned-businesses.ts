import { createClient } from "@/lib/supabase/server";
import type { OwnedBusiness } from "@gather/shared/vendor-business-rules";

interface OwnerRow {
  vendors: { id: string; name: string; primary_category: string | null } | null;
}

export interface OwnedBusinessRow extends OwnedBusiness {
  id: string;
  name: string;
}

// The businesses this user is an active Owner of — what the owner limits
// count. Manager/Staff memberships don't count: being on someone else's team
// isn't creating businesses. Read as the user (their own membership rows are
// always visible to them under vendor_team_members_select_own_team).
export async function getOwnedBusinesses(userId: string): Promise<OwnedBusinessRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_team_members")
    .select("vendors(id, name, primary_category)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("is_active", true)
    .returns<OwnerRow[]>();
  return (data ?? [])
    .filter((row) => row.vendors !== null)
    .map((row) => ({ id: row.vendors!.id, name: row.vendors!.name, primaryCategory: row.vendors!.primary_category }));
}

export interface BusinessRequestRow {
  id: string;
  business_name: string;
  primary_category: string | null;
  needs_extra_slot: boolean;
  needs_duplicate_category: boolean;
  status: "pending" | "approved" | "rejected" | "used";
  rejection_reason: string | null;
  created_at: string;
}

// The user's own exception requests that still matter: the pending one (at
// most one) and any approved-but-unspent ones.
export async function getOpenBusinessRequests(userId: string): Promise<BusinessRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_business_requests")
    .select("id, business_name, primary_category, needs_extra_slot, needs_duplicate_category, status, rejection_reason, created_at")
    .eq("requester_id", userId)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: true })
    .returns<BusinessRequestRow[]>();
  return data ?? [];
}
