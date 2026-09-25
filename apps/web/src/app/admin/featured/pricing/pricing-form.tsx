"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FEATURE_DURATIONS, FEATURE_SPOTS, findPrice, type FeaturePriceRow } from "@gather/shared/feature-pricing";
import { saveFeaturePrices, type PricingFormState } from "./actions";

const initialState: PricingFormState = {};

export function PricingForm({ prices }: { prices: FeaturePriceRow[] }) {
  const [state, formAction, pending] = useActionState(saveFeaturePrices, initialState);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {FEATURE_SPOTS.map((spot) => (
          <Card key={spot.id} className="flex flex-col gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">{spot.label}</h2>
              <p className="text-xs font-semibold text-text-muted">{spot.description}</p>
            </div>
            {FEATURE_DURATIONS.map((duration) => (
              <label key={duration.id} className="flex flex-col gap-1 text-xs font-extrabold text-text-muted">
                {duration.label}
                <CurrencyInput
                  name={`${spot.id}__${duration.id}`}
                  defaultValue={findPrice(prices, spot.id, duration.id) ?? undefined}
                  placeholder="Blank = price on request"
                />
              </label>
            ))}
          </Card>
        ))}
      </div>
      {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
      {state.saved && !state.error && <p className="text-sm font-semibold text-success">Prices saved.</p>}
      <Button type="submit" variant="accent" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save prices"}
      </Button>
    </form>
  );
}
