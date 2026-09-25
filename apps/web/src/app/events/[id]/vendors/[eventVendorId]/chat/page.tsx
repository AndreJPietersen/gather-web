import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../../../access";
import { ChatThread } from "./chat-thread";
import { getRecentChatMessages } from "./actions";

// Event-side entry point for a booking's chat — the vendor-side equivalent
// lives at src/app/vendor/[vendorId]/bookings/[eventVendorId]/chat/page.tsx
// and shares this same ChatThread component and Server Actions, since both
// sides need the identical UI over the identical thread, gated by each
// side's own access check.
export default async function EventVendorChatPage({ params }: PageProps<"/events/[id]/vendors/[eventVendorId]/chat">) {
  const { id, eventVendorId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, owner_id").eq("id", id).maybeSingle();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  if (!access.isOwner && !access.isCollaborator) {
    notFound();
  }
  if (!user) {
    notFound();
  }

  const { data: eventVendor } = await supabase
    .from("event_vendors")
    .select("id, vendor_id, vendors(name)")
    .eq("id", eventVendorId)
    .eq("event_id", event.id)
    .maybeSingle<{ id: string; vendor_id: string; vendors: { name: string } | null }>();
  if (!eventVendor) {
    notFound();
  }

  // Participant names for both sides, resolved once here rather than
  // re-fetched by the client per message — a Realtime-delivered row only
  // ever carries a sender_id, never a joined display name.
  const [{ data: owner }, { data: collaborators }, { data: teamMembers }, initialMessages] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", event.owner_id)
      .maybeSingle<{ id: string; display_name: string | null }>(),
    supabase
      .from("event_collaborators")
      .select("user_id, invitee:profiles!event_collaborators_user_id_profiles_id_fk(display_name)")
      .eq("event_id", event.id)
      .eq("status", "accepted")
      .returns<{ user_id: string; invitee: { display_name: string | null } | null }[]>(),
    supabase
      .from("vendor_team_members")
      .select("user_id, profiles(display_name)")
      .eq("vendor_id", eventVendor.vendor_id)
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
        <p className="text-sm font-semibold text-text-muted">{eventVendor.vendors?.name ?? "Vendor"}</p>
      </PageHeader>

      <ChatThread
        eventVendorId={eventVendor.id}
        currentUserId={user.id}
        participants={participants}
        initialMessages={initialMessages}
        canSend={access.isEditor}
      />
    </main>
  );
}
