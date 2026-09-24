"use client";

import { useActionState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WatchlistThresholds } from "@/lib/admin/watchlist";
import type { WriteRateLimit } from "@/lib/app-settings";
import { saveLimits, saveWatchlistThresholds, saveWriteRateLimits, type SettingsFormState } from "./actions";

const initial: SettingsFormState = {};

function NumberField({ name, label, value, min = 1 }: { name: string; label: string; value: number; min?: number }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm font-semibold text-text">
      <span>{label}</span>
      <Input name={name} type="number" min={min} defaultValue={value} required className="w-24 shrink-0 text-right" aria-label={label} />
    </label>
  );
}

function SettingsCard({
  title,
  description,
  state,
  pending,
  action,
  children,
}: {
  title: string;
  description: string;
  state: SettingsFormState;
  pending: boolean;
  action: (formData: FormData) => void;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        <p className="text-xs font-semibold text-text-muted">{description}</p>
      </div>
      <form action={action} className="flex flex-col gap-2">
        {children}
        <div className="mt-1 flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
          {state.saved && !pending && <p className="text-sm font-semibold text-success">Saved.</p>}
        </div>
      </form>
    </Card>
  );
}

export function LimitsForm({
  maxOwnedBusinesses,
  listingDailyLimit,
  maxEmailRecipients,
}: {
  maxOwnedBusinesses: number;
  listingDailyLimit: number;
  maxEmailRecipients: number;
}) {
  const [state, action, pending] = useActionState(saveLimits, initial);
  return (
    <SettingsCard
      title="Limits"
      description="Listing limits are enforced for everyone, including anyone calling the database directly — going over the business limit, or a second business in one category, needs an approved business request. The email limit guards against accidentally emailing too many people at once."
      state={state}
      pending={pending}
      action={action}
    >
      <NumberField name="max_owned_businesses" label="Businesses one person can own" value={maxOwnedBusinesses} />
      <NumberField name="listing_daily_limit" label="Listings one person can add per 24 hours" value={listingDailyLimit} />
      <NumberField name="max_email_recipients" label="Most recipients per admin email send" value={maxEmailRecipients} />
    </SettingsCard>
  );
}

export function WatchlistThresholdsForm({ t }: { t: WatchlistThresholds }) {
  const [state, action, pending] = useActionState(saveWatchlistThresholds, initial);
  return (
    <SettingsCard
      title="Watchlist thresholds"
      description="When a pattern shows on the watchlist. Warnings only — nothing is blocked."
      state={state}
      pending={pending}
      action={action}
    >
      <NumberField name="watch_listing_min" label="Listings created by one person…" value={t.listingMin} />
      <NumberField name="watch_listing_days" label="…within this many days" value={t.listingDays} />
      <NumberField name="watch_contact_min" label="Listings sharing one phone or website" value={t.contactMin} min={2} />
      <NumberField name="watch_team_min" label="Vendor teams one person is on" value={t.teamMin} />
      <NumberField name="watch_claim_min" label="Listing claims by one person…" value={t.claimMin} />
      <NumberField name="watch_claim_days" label="…within this many days" value={t.claimDays} />
      <NumberField name="watch_invite_min" label="Team invites sent by one person…" value={t.inviteMin} />
      <NumberField name="watch_invite_days" label="…within this many days" value={t.inviteDays} />
    </SettingsCard>
  );
}

export function WriteRateLimitsForm({ limits }: { limits: WriteRateLimit[] }) {
  const [state, action, pending] = useActionState(saveWriteRateLimits, initial);
  return (
    <SettingsCard
      title="Hourly limits per person"
      description="The most of each thing one signed-in person can create in an hour — protection against someone flooding the site through the API. Set well above normal use; admin actions aren't limited."
      state={state}
      pending={pending}
      action={action}
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
        {limits.map((l) => (
          <NumberField key={l.table_name} name={`limit__${l.table_name}`} label={l.label} value={l.max_per_hour} />
        ))}
      </div>
    </SettingsCard>
  );
}
