"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PercentInput } from "@/components/ui/percent-input";
import { useDirtyFormGuard } from "@/lib/hooks/use-dirty-form-guard";
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
  rsvpDate?: string | null;
  location?: string;
  description?: string;
  visibility?: "public" | "private" | "invite_only";
  capacity?: number | null;
  budgetTotal?: number | null;
  budgetWarningPercent?: number | null;
  published?: boolean;
}

const OTHER_VALUE = "other";

// "YYYY-MM-DDTHH:mm", the format datetime-local inputs use.
function addOneHour(dateTimeLocal: string): string {
  const date = new Date(dateTimeLocal);
  if (Number.isNaN(date.getTime())) return dateTimeLocal;
  date.setHours(date.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  const { formProps: dirtyGuardProps } = useDirtyFormGuard();
  // Controlled because the free-text "Other" input's visibility depends on
  // this value, which needs a live re-render to react to.
  const [selectedType, setSelectedType] = useState(
    defaultValues?.eventTypeId ? defaultValues.eventTypeId : defaultValues?.eventTypeOther ? OTHER_VALUE : "",
  );

  // Start/end also need to be controlled (not just defaultValue): end stays
  // blank until the planner actually opens it, at which point it defaults to
  // start + 1 hour rather than today's date. It does NOT track start after
  // that first fill — once end has a value (typed, defaulted, or loaded from
  // an existing event), changing start leaves it alone.
  const [startAt, setStartAt] = useState(defaultValues?.startAt ?? "");
  const [endAt, setEndAt] = useState(defaultValues?.endAt ?? "");

  function handleEndFocus() {
    if (!endAt && startAt) {
      setEndAt(addOneHour(startAt));
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} {...dirtyGuardProps} className="flex flex-col gap-3">
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
          <Input
            name="startAt"
            type="datetime-local"
            required
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </Field>
        <Field label="End (optional)">
          <Input
            name="endAt"
            type="datetime-local"
            value={endAt}
            min={startAt || undefined}
            onFocus={handleEndFocus}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </Field>
        <p className="-mt-2 text-xs font-semibold text-text-muted">Timezone: Africa/Johannesburg (SAST)</p>

        <Field label="RSVP by (optional)">
          <Input
            name="rsvpDate"
            type="date"
            max={startAt ? startAt.slice(0, 10) : undefined}
            defaultValue={defaultValues?.rsvpDate ?? undefined}
          />
        </Field>
        <p className="-mt-2 text-xs font-semibold text-text-muted">
          Shown to you as a countdown on the Attendees page. Once it passes, the headline number there switches from
          &quot;invited&quot; to &quot;attending.&quot;
        </p>

        <Input name="location" placeholder="Location" defaultValue={defaultValues?.location} />
        <Input name="description" placeholder="Tell us more about your event" defaultValue={defaultValues?.description} />

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
        <p className="-mt-2 text-xs font-semibold text-text-muted">
          Only Public shows up in the guest directory — Private and Invite only both stay unlisted (a shared link still
          works either way).
        </p>

        <Input
          name="capacity"
          type="number"
          min={1}
          placeholder="Total guests (optional)"
          defaultValue={defaultValues?.capacity ?? undefined}
        />

        <CurrencyInput
          name="budgetTotal"
          placeholder="Total budget (ZAR, optional)"
          defaultValue={defaultValues?.budgetTotal}
        />
        <Field label={`Budget warning threshold (defaults to ${DEFAULT_BUDGET_WARNING_PERCENT}%)`}>
          <PercentInput
            name="budgetWarningPercent"
            placeholder={`${DEFAULT_BUDGET_WARNING_PERCENT}`}
            defaultValue={defaultValues?.budgetWarningPercent}
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
