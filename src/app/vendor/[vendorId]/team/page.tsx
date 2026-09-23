import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../access";
import { InviteForm } from "./invite-form";
import { updateMemberRole, revokeMember } from "./actions";

interface MemberRow {
  id: string;
  role: "owner" | "manager" | "staff";
  user_id: string;
  profiles: { display_name: string | null } | null;
}

interface PendingInviteRow {
  id: string;
  invited_email: string;
  role: "owner" | "manager" | "staff";
  status: "invited" | "accepted" | "declined";
}

export default async function VendorTeamPage({ params }: PageProps<"/vendor/[vendorId]/team">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", vendorId).maybeSingle();
  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  if (!access.isTeamMember) {
    notFound();
  }

  const isOwner = access.role === "owner";

  const { data: members } = await supabase
    .from("vendor_team_members")
    .select("id, role, user_id, profiles(display_name)")
    .eq("vendor_id", vendorId)
    .eq("is_active", true)
    .returns<MemberRow[]>();

  let pendingInvites: PendingInviteRow[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("vendor_team_invites")
      .select("id, invited_email, role, status")
      .eq("vendor_id", vendorId)
      .eq("status", "invited")
      .returns<PendingInviteRow[]>();
    pendingInvites = data ?? [];
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Team">
        <p className="text-sm font-semibold text-text-muted">{vendor.name}</p>
        <p className="text-xs font-semibold text-text-muted">
          Managers can edit the business and send quotes; Staff can only view bookings.
        </p>
      </PageHeader>

      <StaggerList className="flex flex-col gap-2">
        {(members ?? []).map((member) => (
          <StaggerItem key={member.id}>
            <Card className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-text">{member.profiles?.display_name ?? "Team member"}</p>
              {isOwner && member.role !== "owner" ? (
                <div className="flex items-center gap-2">
                  <form action={updateMemberRole} className="flex items-center gap-1">
                    <input type="hidden" name="memberId" value={member.id} />
                    <input type="hidden" name="vendorId" value={vendorId} />
                    <select
                      name="role"
                      defaultValue={member.role}
                      className="rounded-field border-2 border-border bg-surface px-2 py-1 text-xs font-bold text-text"
                    >
                      <option value="manager">Manager</option>
                      <option value="staff">Staff</option>
                    </select>
                    <button type="submit" className="text-xs font-extrabold text-primary">
                      Save
                    </button>
                  </form>
                  <form action={revokeMember}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <input type="hidden" name="vendorId" value={vendorId} />
                    <button type="submit" className="text-xs font-extrabold text-primary">
                      Revoke
                    </button>
                  </form>
                </div>
              ) : (
                <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
                  {member.role}
                </span>
              )}
            </Card>
          </StaggerItem>
        ))}
      </StaggerList>

      {isOwner && (
        <>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Invite a teammate</h2>
            <div className="mt-3">
              <InviteForm vendorId={vendorId} />
            </div>
          </div>

          {pendingInvites.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Pending Invites</h2>
              <StaggerList className="mt-3 flex flex-col gap-2">
                {pendingInvites.map((invite) => (
                  <StaggerItem key={invite.id}>
                    <Card className="flex items-center justify-between">
                      <p className="text-sm font-bold text-text">{invite.invited_email}</p>
                      <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
                        {invite.role}
                      </span>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          )}
        </>
      )}
    </main>
  );
}
