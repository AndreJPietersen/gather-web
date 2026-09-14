"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { saveNotificationPreferences, type SaveNotificationPreferencesState } from "./actions";

const initialState: SaveNotificationPreferencesState = {};

export function NotificationPreferencesForm({
  emailReminders,
  upcomingWindow,
}: {
  emailReminders: boolean;
  upcomingWindow: "on_day" | "one_day_before" | "one_week_before";
}) {
  const [state, formAction, pending] = useActionState(saveNotificationPreferences, initialState);
  const router = useRouter();

  // See this action's own comment for why: revalidatePath() alone left the
  // already-mounted select showing the pre-save option until a hard
  // reload, the exact same staleness AcceptQuoteForm hit and fixed the
  // same way — a client-triggered refresh, run after useActionState has
  // already committed this response.
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-text">
        <input type="checkbox" name="emailReminders" defaultChecked={emailReminders} />
        Email payment reminders
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-text-muted opacity-60">
        <input type="checkbox" disabled />
        SMS reminders (coming soon)
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-text-muted opacity-60">
        <input type="checkbox" disabled />
        Push reminders (coming soon)
      </label>

      <Field label="Show upcoming tasks & payments">
        {/* key={upcomingWindow}: an uncontrolled <select>'s defaultValue is
            only applied on mount, not on a later update — router.refresh()
            does fetch the fresh saved value into this prop, but without a
            changed key React reuses the same DOM node and never re-applies
            it, which is the actual reason the option looked like it
            "jumped back" right after a save (it hadn't updated at all).
            Keying on the value itself forces a real remount whenever it
            changes, so the freshly-saved option always wins. */}
        <select
          key={upcomingWindow}
          name="upcomingWindow"
          defaultValue={upcomingWindow}
          className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
        >
          <option value="one_week_before">Starting 1 week before</option>
          <option value="one_day_before">Starting 1 day before</option>
          <option value="on_day">Only on the day</option>
        </select>
      </Field>
      <p className="-mt-2 text-xs font-semibold text-text-muted">
        Controls what shows up in Home&apos;s Upcoming Tasks/Payments and the pending markers on My Events.
      </p>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
