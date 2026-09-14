"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface EventFormState {
  error?: string;
}

export interface EventFormDefaults {
  name?: string;
  eventType?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  description?: string;
  visibility?: "public" | "private" | "invite_only";
  capacity?: number | null;
  published?: boolean;
}

interface EventFormProps {
  action: (prevState: EventFormState, formData: FormData) => Promise<EventFormState>;
  eventId?: string;
  defaultValues?: EventFormDefaults;
  submitLabel: string;
}

// Shared by /events/new and /events/[id]/edit — a single scrollable form
// rather than the Salesforce build's 4-step wizard. That was a deliberate
// simplification for a mobile-first Next.js page, not an oversight: a
// wizard's main value was pacing a small-screen LWC experience, and a
// single form works just as well on the same screen size here.
export function EventForm({ action, eventId, defaultValues, submitLabel }: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        {eventId && <input type="hidden" name="eventId" value={eventId} />}
        <Input name="name" placeholder="Event name" required defaultValue={defaultValues?.name} />
        <Input name="eventType" placeholder="Type (e.g. Wedding)" defaultValue={defaultValues?.eventType} />

        <label className="flex flex-col gap-1 text-xs font-extrabold text-text-muted">
          Start
          <Input name="startAt" type="datetime-local" required defaultValue={defaultValues?.startAt} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-extrabold text-text-muted">
          End (optional)
          <Input name="endAt" type="datetime-local" defaultValue={defaultValues?.endAt} />
        </label>
        <p className="-mt-2 text-xs font-semibold text-text-muted">Timezone: Africa/Johannesburg (SAST)</p>

        <Input name="location" placeholder="Location" defaultValue={defaultValues?.location} />
        <Input name="description" placeholder="Description" defaultValue={defaultValues?.description} />

        <label className="flex flex-col gap-1 text-xs font-extrabold text-text-muted">
          Visibility
          <select
            name="visibility"
            defaultValue={defaultValues?.visibility ?? "private"}
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="private">Private</option>
            <option value="invite_only">Invite only</option>
            <option value="public">Public</option>
          </select>
        </label>

        <Input
          name="capacity"
          type="number"
          min={1}
          placeholder="Capacity (optional)"
          defaultValue={defaultValues?.capacity ?? undefined}
        />

        <label className="flex items-center gap-2 text-sm font-semibold text-text">
          <input type="checkbox" name="publish" value="true" defaultChecked={defaultValues?.published} />
          Publish (visible to guests if also Public)
        </label>

        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
