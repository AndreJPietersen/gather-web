"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn, formatEventDate, formatZAR } from "@/lib/utils";
import {
  FEATURE_DURATIONS,
  FEATURE_SPOTS,
  endDateFor,
  findPrice,
  type FeatureDuration,
  type FeaturePriceRow,
  type FeatureSpot,
} from "@/lib/feature-pricing";
import { requestFeaturedPlacement, type FeatureRequestState } from "./actions";

const initialState: FeatureRequestState = {};

export function FeatureRequestForm({
  vendorId,
  prices,
  defaultStart,
  minStart,
}: {
  vendorId: string;
  prices: FeaturePriceRow[];
  defaultStart: string;
  minStart: string;
}) {
  const [state, formAction, pending] = useActionState(requestFeaturedPlacement, initialState);
  const [spot, setSpot] = useState<FeatureSpot>("rotating");
  const [duration, setDuration] = useState<FeatureDuration>("1_month");
  const [startsOn, setStartsOn] = useState(defaultStart);

  const price = findPrice(prices, spot, duration);
  const endsOn = /^\d{4}-\d{2}-\d{2}$/.test(startsOn) ? endDateFor(startsOn, duration) : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="spot" value={spot} />
      <input type="hidden" name="duration" value={duration} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-extrabold text-text-muted">Spot</legend>
        {FEATURE_SPOTS.map((option) => {
          const active = spot === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSpot(option.id)}
              aria-pressed={active}
              className={cn(
                "flex items-start justify-between gap-3 rounded-[16px] border-2 p-3 text-left",
                active ? "border-primary bg-primary-soft" : "border-border bg-surface",
              )}
            >
              <span>
                <span className="block text-sm font-extrabold text-ink">{option.label}</span>
                <span className="block text-xs font-semibold text-text-muted">{option.description}</span>
              </span>
              <span
                aria-hidden
                className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full", active ? "border-[5px] border-primary" : "border-2 border-border")}
              />
            </button>
          );
        })}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-extrabold text-text-muted">How long</legend>
        <div className="grid grid-cols-3 gap-2">
          {FEATURE_DURATIONS.map((option) => {
            const active = duration === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDuration(option.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-pill border-2 py-2 text-xs font-extrabold",
                  active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Start from">
        <Input name="startsOn" type="date" required min={minStart} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      </Field>

      <div className="rounded-[16px] bg-secondary-soft p-3 text-sm font-bold text-ink">
        {price !== null ? `${formatZAR(price)}` : "Price on request"}
        {endsOn && <span className="block text-xs font-semibold text-text-muted">Runs until {formatEventDate(endsOn)}</span>}
      </div>

      <Field label="Anything we should know? (optional)">
        <textarea
          name="vendorNote"
          rows={3}
          maxLength={500}
          placeholder="e.g. a push for wedding season"
          className="w-full rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
        />
      </Field>

      {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
      <p className="text-center text-xs font-semibold text-text-muted">
        Nothing is charged yet — Gather will confirm the price and dates first.{" "}
        <Link href="/featured" className="font-extrabold text-primary">
          See all prices
        </Link>
      </p>
    </form>
  );
}
