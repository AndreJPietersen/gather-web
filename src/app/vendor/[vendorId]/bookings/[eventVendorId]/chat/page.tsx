import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../../../access";
import { ChatThread } from "@/app/events/[id]/vendors/[eventVendorId]/chat/chat-thread";
import { getRecentChatMessages } from "@/app/events/[id]/vendors/[eventVendorId]/chat/actions";

// Vendor-side entry point for a booking's chat — no single-booking detail
// route existed on the vendor side before this (bookings were only ever
// shown as cards on /vendor/[vendorId]/dashboard), so this is a new route
// tree. Shares ChatThread and the sendChatMessage/getSignedChatImageUrl
// Server Actions directly with the event-side page at
// src/app/events/[id]/vendors/[eventVendorId]/chat/ rather than duplicating
// either — both sides need the identical UI over the identical thread.
export default async function VendorBookingChatPage({
  params,
}: PageProps<"/vendor/[vendorId]/bookings/[eventVendorId]/chat">) {
  const { vendorId, eventVendorId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  if (!access.isTeamMember) {
    notFound();
  }
  if (!user) {
    notFound();
  }

  const { data: eventVendor } = await supabase
    .from("event_vendors")
    .select("id, event_id, events(name, owner_id)")
    .eq("id", eventVendorId)
    .eq("vendor_id", vendorId)
    .maybeSingle<{ id: string; event_id: string; events: { name: string; owner_id: string } | null }>();
  if (!eventVendor || !eventVendor.events) {
    notFound();
  }

  // RLS (event_vendor_messages_insert_..., updated after shipping — see its
  // own comment in schema.ts) requires the vendor side to be verified
  // before it can insert, the same is_vendor_verified gate
  // vendor_gallery_images/vendor_social_links already use — a vendor's
  // creator becomes its Owner team member with zero verification at all,
  // so without this any freshly-created, unreviewed vendor stub could
  // message any planner. This fetch is what lets the composer explain why
  // instead of the vendor hitting a bare RLS failure on send.
  const { data: vendor } = await supabase
    .from("vendors")
    .select("verification_status")
    .eq("id", vendorId)
    .maybeSingle<{ verification_status: "unclaimed" | "claim_pending" | "verified" }>();
  const isVerified = vendor?.verification_status === "verified";

  const [{ data: owner }, { data: collaborators }, { data: teamMembers }, initialMessages] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", eventVendor.events.owner_id)
      .maybeSingle<{ id: string; display_name: string | null }>(),
    supabase
      .from("event_collaborators")
      .select("user_id, invitee:profiles!event_collaborators_user_id_profiles_id_fk(display_name)")
      .eq("event_id", eventVendor.event_id)
      .eq("status", "accepted")
      .returns<{ user_id: string; invitee: { display_name: string | null } | null }[]>(),
    supabase
      .from("vendor_team_members")
      .select("user_id, profiles(display_name)")
      .eq("vendor_id", vendorId)
      .eq("is_active", true)
      .returns<{ user_id: string; profiles: { display_name: string | null } | null }[]>(),
    getRecentChatMessages(eventVendor.id),
  ]);

  const participants = [
    ...(owner ? [{ id: owner.id, name: owner.display_name ?? "Host" }] : []),
    ...(collaborators ?? []).map((c) => ({ id: c.user_id, name: c.invitee?.display_name ?? "Collaborator" })),
    ...(teamMembers ?? []).map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? "Vendor team" })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Chat">
        <p className="text-sm font-semibold text-text-muted">{eventVendor.events.name}</p>
      </PageHeader>

      <ChatThread
        eventVendorId={eventVendor.id}
        currentUserId={user.id}
        participants={participants}
        initialMessages={initialMessages}
        canSend={isVerified}
        lockedMessage={
          isVerified ? undefined : "Sending messages is only available to verified vendors — claim and verify this listing first."
        }
      />
    </main>
  );
}
