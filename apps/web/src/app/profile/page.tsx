import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, LinkCard } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { PatternSwitcher } from "@/components/theme/pattern-switcher";
import { PersonaSwitcher } from "@/components/nav/persona-switcher";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { vendorInitials } from "@gather/shared/vendor-gradient";
import { getOpenBusinessRequests, getOwnedBusinesses, type BusinessRequestRow, type OwnedBusinessRow } from "@/lib/owned-businesses";
import { getMaxOwnedBusinesses } from "@/lib/app-settings";
import { signOut, respondToEventInvite, respondToVendorInvite } from "./actions";
import { DeleteAccountForm } from "./delete-account-form";
import { NotificationPreferencesForm } from "./notification-preferences-form";
import { isSuppressed } from "@/lib/email/suppressions";

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

  let owned: OwnedBusinessRow[] = [];
  let maxOwned = 5;
  let businessRequests: BusinessRequestRow[] = [];
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
    [owned, businessRequests, maxOwned] = await Promise.all([
      getOwnedBusinesses(session.userId),
      getOpenBusinessRequests(session.userId),
      getMaxOwnedBusinesses(),
    ]);

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

  // Only for the identity hero's subtitle line — getSessionContext() itself
  // deliberately only returns displayName (see its own doc comment on why
  // it's read fresh rather than cached), not email, so this is its own
  // small targeted fetch rather than widening that shared type for one
  // display line.
  let email: string | null = null;
  if (session.status === "authenticated") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  // No row exists until the first save — default to the column defaults
  // (email on, sms/push off, one-week lookahead) rather than treating "no
  // row" as an error.
  let emailReminders = true;
  // Announcements are on unless this address is on the opt-out list.
  const announcements = email ? !(await isSuppressed(email)) : true;
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

      {session.status === "authenticated" && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Support</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Card className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-text">Have a question?</p>
              <Link href="/faq" className="shrink-0 text-xs font-extrabold text-primary">
                Check the FAQ
              </Link>
            </Card>
            <Card className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-text">Something not working, or need help?</p>
              <Link href="/profile/cases" className="shrink-0 text-xs font-extrabold text-primary">
                Report an Issue
              </Link>
            </Card>
          </div>
        </div>
      )}

      {/* The identity hero — Andre's own feedback that the old "Signed in
          as Andre." sentence + a full-width Log out button read as a
          settings row, not a profile. Reuses Home's exact gradient-hero
          language (the "Welcome back" card) rather than inventing a new
          visual style, with the same asymmetry that design canvas landed
          on: Edit Profile is the one clear action, Log out is demoted to a
          small icon (the same circular treatment BackButton already uses)
          so the two stop competing for equal visual weight. */}
      {session.status === "authenticated" && (
        <div className="relative flex flex-col gap-4 rounded-[26px] bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] p-6 shadow-[0_10px_24px_-10px_var(--color-primary)]">
          <form action={signOut} className="absolute right-4 top-4">
            <button
              type="submit"
              title="Log out"
              aria-label="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-white/40 bg-white/20 text-white transition-opacity active:opacity-70"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>

          <div className="flex items-center gap-3.5">
            <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-pill border border-white/40 bg-white/20 font-display text-xl font-semibold text-white">
              {vendorInitials(session.displayName ?? email ?? "you")}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-semibold leading-tight text-white">{session.displayName ?? "Your profile"}</p>
              {email && <p className="mt-0.5 truncate text-xs font-bold text-white/85">{email}</p>}
            </div>
          </div>

          <Link href="/profile/edit" className="rounded-pill bg-white px-6 py-3.5 text-center text-[14.5px] font-extrabold text-primary">
            Edit Profile
          </Link>
        </div>
      )}

      {/* Shown to everyone signed in, not only multi-persona accounts —
          before this, a planner-only account had no way at all to find
          vendor registration again after sign-up, and an owner of one
          business had no visible route to a second. */}
      {session.status === "authenticated" && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{session.personas.length > 1 ? "Switch Persona" : "Your Businesses"}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {session.personas.length > 1 && (
              <Card>
                <PersonaSwitcher />
              </Card>
            )}
            <LinkCard href="/onboarding/vendor" className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-ink">+ Add a business</span>
                <span className="block text-xs font-semibold text-text-muted">
                  {owned.length === 0
                    ? "Offer your services to planners on Gather."
                    : `You own ${owned.length} of ${maxOwned}${owned.length >= maxOwned ? " — more needs approval" : ""}.`}
                </span>
              </span>
              <span aria-hidden className="text-lg font-extrabold text-text-muted">
                ›
              </span>
            </LinkCard>
            {businessRequests.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-bold text-text">
                  {r.business_name}: {r.status === "pending" ? "waiting for approval" : "approved — ready to create"}
                </p>
                {r.status === "approved" && (
                  <Link href="/onboarding/vendor" className="shrink-0 text-xs font-extrabold text-primary">
                    Create it
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {session.status === "authenticated" && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Notifications & Reminders</h2>
          <Card className="mt-3 flex flex-col gap-3">
            <NotificationPreferencesForm emailReminders={emailReminders} announcements={announcements} upcomingWindow={upcomingWindow} />
          </Card>
        </div>
      )}

      {session.status === "authenticated" && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Your data</h2>
          <Card className="mt-3 flex flex-col gap-3">
            <p className="text-xs font-semibold text-text-muted">
              Want a copy of your information? Email us and we&apos;ll send it — see the{" "}
              <Link href="/privacy" className="underline">
                privacy policy
              </Link>
              .
            </p>
            <DeleteAccountForm />
          </Card>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Theme</h2>
        <Card className="mt-3">
          <ThemeSwitcher />
        </Card>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Background</h2>
        <Card className="mt-3">
          <PatternSwitcher />
        </Card>
      </div>

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
