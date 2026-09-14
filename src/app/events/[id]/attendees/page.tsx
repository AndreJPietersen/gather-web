import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../access";
import { AddAttendeeForm } from "./add-attendee-form";

interface AttendeeRow {
  id: string;
  name: string | null;
  email: string | null;
  rsvp_status: "attending" | "declined" | "maybe" | "no_response";
  guest_count: number;
}

const rsvpLabelClasses: Record<AttendeeRow["rsvp_status"], string> = {
  attending: "bg-success-soft text-ink",
  declined: "bg-primary-soft text-primary",
  maybe: "bg-secondary-soft text-ink",
  no_response: "bg-surface text-text-muted border-2 border-border",
};

export default async function EventAttendeesPage({ params }: PageProps<"/events/[id]/attendees">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, owner_id, name").eq("id", id).maybeSingle();
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

  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("id, name, email, rsvp_status, guest_count")
    .eq("event_id", event.id)
    .order("name", { ascending: true })
    .returns<AttendeeRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Attendees</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">{event.name}</p>
      </div>

      {access.isEditor && <AddAttendeeForm eventId={event.id} />}

      <div className="flex flex-col gap-2">
        {attendees && attendees.length > 0 ? (
          attendees.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-text">{a.name ?? a.email ?? "Guest"}</p>
                {a.guest_count > 0 && (
                  <p className="text-xs font-semibold text-text-muted">+{a.guest_count} guest(s)</p>
                )}
              </div>
              <span
                className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${rsvpLabelClasses[a.rsvp_status]}`}
              >
                {a.rsvp_status.replace("_", " ")}
              </span>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No attendees yet.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
