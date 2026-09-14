import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { PersonaSwitcher } from "@/components/nav/persona-switcher";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut, respondToEventInvite, respondToVendorInvite } from "./actions";
import { NotificationPreferencesForm } from "./notification-preferences-form";

interface PendingInvite {
  id: string;
  permission_level: "editor" | "viewer";
  events: { id: string; name: string } | null;
}

interface PendingVendorInvite {
  id: string;
  role: "owner" | "manager" | "staff";
  vendor_id: string;
  vendors: { name: string } | null;
}

// Phase 5 adds a first real section (pending event invites) to what was a
// Phase 2 sign-out-only stub — matching the Salesforce build's own history:
// gatherProfile started as exactly this same minimal stub in its Epic 5,
// before growing into the full Profile Hub in Epic 9. This project's own
// Phase 9 does the same for the rest (personal info, vendor claims/invites).
export default async function ProfilePage() {
  const session = await getSessionContext();

  let pendingInvites: PendingInvite[] = [];
  let pendingVendorInvites: PendingVendorInvite[] = [];
  if (session.status === "authenticated") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("event_collaborators")
      .select("id, permission_level, events(id, name)")
      .eq("user_id", session.userId)
      .eq("status", "invited")
      .returns<PendingInvite[]>();
    pendingInvites = data ?? [];

    // vendor_team_invites' SELECT policy is an OR of two branches: "I'm
    // already an active team member of this vendor" (so I can see who else
    // is pending) or "this invite's email matches mine." Without excluding
    // vendors I already belong to, this section would also surface invites
    // *other people* are waiting on at a vendor I'm already on — visible to
    // me via the team-member branch, but not actually addressed to me.
    const { data: myVendorIds } = await supabase
      .from("vendor_team_members")
      .select("vendor_id")
      .eq("user_id", session.userId)
      .eq("is_active", true);
    const excludedVendorIds = (myVendorIds ?? []).map((v) => v.vendor_id);

    let vendorInvitesQuery = supabase
      .from("vendor_team_invites")
      .select("id, role, vendor_id, vendors(name)")
      .eq("status", "invited");
    if (excludedVendorIds.length > 0) {
      vendorInvitesQuery = vendorInvitesQuery.not("vendor_id", "in", `(${excludedVendorIds.join(",")})`);
    }
    const { data: vendorInvites } = await vendorInvitesQuery.returns<PendingVendorInvite[]>();
    pendingVendorInvites = vendorInvites ?? [];
  }

  // No row exists until the first save — default to the column defaults
  // (email on, sms/push off, one-week lookahead) rather than treating "no
  // row" as an error.
  let emailReminders = true;
  let upcomingWindow: "on_day" | "one_day_before" | "one_week_before" = "one_week_before";
  if (session.status === "authenticated") {
    const supabase = await createClient();
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_reminders, upcoming_window")
      .eq("profile_id", session.userId)
      .maybeSingle();
    if (prefs) {
      emailReminders = prefs.email_reminders;
      upcomingWindow = prefs.upcoming_window;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Profile</h1>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Theme</h2>
        <Card className="mt-3">
          <ThemeSwitcher />
        </Card>
      </div>

      {session.status === "authenticated" && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-text">Signed in as {session.displayName ?? "you"}.</p>
            <Link href="/profile/edit" className="shrink-0 text-xs font-extrabold text-primary">
              Edit Profile
            </Link>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Log out
            </Button>
          </form>
        </Card>
      )}

      {session.status === "authenticated" && session.personas.length > 1 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Switch Persona</h2>
          <Card className="mt-3">
            <PersonaSwitcher />
          </Card>
        </div>
      )}

      {session.status === "authenticated" && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Notifications & Reminders</h2>
          <Card className="mt-3 flex flex-col gap-3">
            <NotificationPreferencesForm emailReminders={emailReminders} upcomingWindow={upcomingWindow} />
          </Card>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Event Invites</h2>
          <div className="mt-3 flex flex-col gap-2">
            {pendingInvites.map((invite) => (
              <Card key={invite.id} className="flex flex-col gap-2">
                <p className="text-sm font-bold text-text">
                  {invite.events?.name ?? "An event"} · {invite.permission_level}
                </p>
                <div className="flex gap-2">
                  <form action={respondToEventInvite} className="flex-1">
                    <input type="hidden" name="collaboratorId" value={invite.id} />
                    <input type="hidden" name="decision" value="accepted" />
                    <Button type="submit" variant="primary" className="w-full">
                      Accept
                    </Button>
                  </form>
                  <form action={respondToEventInvite} className="flex-1">
                    <input type="hidden" name="collaboratorId" value={invite.id} />
                    <input type="hidden" name="decision" value="declined" />
                    <Button type="submit" variant="secondary" className="w-full">
                      Decline
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingVendorInvites.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Vendor Team Invites</h2>
          <div className="mt-3 flex flex-col gap-2">
            {pendingVendorInvites.map((invite) => (
              <Card key={invite.id} className="flex flex-col gap-2">
                <p className="text-sm font-bold text-text">
                  {invite.vendors?.name ?? "A vendor"} · {invite.role}
                </p>
                <div className="flex gap-2">
                  <form action={respondToVendorInvite} className="flex-1">
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <input type="hidden" name="vendorId" value={invite.vendor_id} />
                    <input type="hidden" name="role" value={invite.role} />
                    <input type="hidden" name="decision" value="accepted" />
                    <Button type="submit" variant="primary" className="w-full">
                      Accept
                    </Button>
                  </form>
                  <form action={respondToVendorInvite} className="flex-1">
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <input type="hidden" name="vendorId" value={invite.vendor_id} />
                    <input type="hidden" name="role" value={invite.role} />
                    <input type="hidden" name="decision" value="declined" />
                    <Button type="submit" variant="secondary" className="w-full">
                      Decline
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
