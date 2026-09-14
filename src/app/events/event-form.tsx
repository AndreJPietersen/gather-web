"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DEFAULT_BUDGET_WARNING_PERCENT } from "./budget-constants";

export interface EventFormState {
  error?: string;
}

export interface EventFormDefaults {
  name?: string;
  eventTypeId?: string | null;
  eventTypeOther?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  description?: string;
  visibility?: "public" | "private" | "invite_only";
  capacity?: number | null;
  budgetTotal?: number | null;
  budgetWarningPercent?: number | null;
  published?: boolean;
}

const OTHER_VALUE = "other";

interface EventFormProps {
  action: (prevState: EventFormState, formData: FormData) => Promise<EventFormState>;
  eventId?: string;
  eventTypes: { id: string; name: string }[];
  defaultValues?: EventFormDefaults;
  submitLabel: string;
}

// Shared by /events/new and /events/[id]/edit — a single scrollable form
// rather than the Salesforce build's 4-step wizard. That was a deliberate
// simplification for a mobile-first Next.js page, not an oversight: a
// wizard's main value was pacing a small-screen LWC experience, and a
// single form works just as well on the same screen size here.
export function EventForm({ action, eventId, eventTypes, defaultValues, submitLabel }: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  // The one controlled field in this form — everything else stays
  // uncontrolled/defaultValue, but the free-text "Other" input's visibility
  // depends on this value, which needs a live re-render to react to.
  const [selectedType, setSelectedType] = useState(
    defaultValues?.eventTypeId ? defaultValues.eventTypeId : defaultValues?.eventTypeOther ? OTHER_VALUE : "",
  );

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        {eventId && <input type="hidden" name="eventId" value={eventId} />}
        <Input name="name" placeholder="Event name" required defaultValue={defaultValues?.name} />

        <Field label="Event type">
          <select
            name="eventTypeId"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="">Choose a type…</option>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
            <option value={OTHER_VALUE}>Other</option>
          </select>
        </Field>
        {selectedType === OTHER_VALUE && (
          <Input name="eventTypeOther" placeholder="Describe the event type" required defaultValue={defaultValues?.eventTypeOther} />
        )}

        <Field label="Start">
          <Input name="startAt" type="datetime-local" required defaultValue={defaultValues?.startAt} />
        </Field>
        <Field label="End (optional)">
          <Input name="endAt" type="datetime-local" defaultValue={defaultValues?.endAt} />
        </Field>
        <p className="-mt-2 text-xs font-semibold text-text-muted">Timezone: Africa/Johannesburg (SAST)</p>

        <Input name="location" placeholder="Location" defaultValue={defaultValues?.location} />
        <Input name="description" placeholder="Description" defaultValue={defaultValues?.description} />

        <Field label="Visibility">
          <select
            name="visibility"
            defaultValue={defaultValues?.visibility ?? "private"}
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="private">Private</option>
            <option value="invite_only">Invite only</option>
            <option value="public">Public</option>
          </select>
        </Field>

        <Input
          name="capacity"
          type="number"
          min={1}
          placeholder="Capacity (optional)"
          defaultValue={defaultValues?.capacity ?? undefined}
        />

        <Input
          name="budgetTotal"
          type="number"
          min={0}
          step="0.01"
          placeholder="Total budget (ZAR, optional)"
          defaultValue={defaultValues?.budgetTotal ?? undefined}
        />
        <Field label={`Budget warning threshold (defaults to ${DEFAULT_BUDGET_WARNING_PERCENT}%)`}>
          <Input
            name="budgetWarningPercent"
            type="number"
            min={1}
            max={100}
            placeholder={`${DEFAULT_BUDGET_WARNING_PERCENT}`}
            defaultValue={defaultValues?.budgetWarningPercent ?? undefined}
          />
        </Field>

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
