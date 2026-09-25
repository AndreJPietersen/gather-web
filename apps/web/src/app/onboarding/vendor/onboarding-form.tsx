"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  registerVendorBusiness,
  requestBusinessException,
  type BusinessRequestState,
  type VendorOnboardingState,
} from "./actions";

const initialState: VendorOnboardingState = {};
const requestInitialState: BusinessRequestState = {};

const controlClasses = "w-full rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text";

export function VendorOnboardingForm({ categories }: { categories: string[] }) {
  const [state, formAction, pending] = useActionState(registerVendorBusiness, initialState);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        {/* Keyed on the blocked attempt so the form remounts with it as its
            defaults — React's post-action form reset otherwise put the
            category <select> back to "Choose a category…". */}
        <form
          key={state.blocked ? `${state.blocked.name}|${state.blocked.primaryCategory}` : "new"}
          action={formAction}
          className="flex flex-col gap-3"
        >
          <Input name="name" placeholder="Business name" required defaultValue={state.blocked?.name} />
          <Field label="Category">
            <select name="primaryCategory" required defaultValue={state.blocked?.primaryCategory ?? ""} className={controlClasses}>
              <option value="" disabled>
                Choose a category…
              </option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Input name="description" placeholder="Short description" />
          <Input name="phone" type="tel" placeholder="Phone (optional)" />
          <Input name="website" type="url" placeholder="Website (optional)" />
          {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Creating…" : "Create business"}
          </Button>
        </form>
      </Card>

      {state.blocked && <ExceptionRequest blocked={state.blocked} />}
    </div>
  );
}

function ExceptionRequest({ blocked }: { blocked: NonNullable<VendorOnboardingState["blocked"]> }) {
  const [state, formAction, pending] = useActionState(requestBusinessException, requestInitialState);

  const reasons: string[] = [];
  if (blocked.overLimit) reasons.push(`you already own ${blocked.ownedCount} businesses (the limit is ${blocked.limit})`);
  if (blocked.duplicateCategory) reasons.push(`you already own a ${blocked.primaryCategory} business`);

  return (
    <Card className="flex flex-col gap-3 border-2 border-secondary">
      <div>
        <p className="text-sm font-extrabold text-ink">This one needs approval</p>
        <p className="mt-1 text-xs font-semibold text-text-muted">
          We can&apos;t create {blocked.name} straight away because {reasons.join(" and ")}. If it&apos;s a genuinely
          separate business, ask us and an admin will review it.
        </p>
      </div>
      {blocked.hasPendingRequest ? (
        <p className="text-xs font-bold text-text">
          You already have a request waiting for review — we&apos;ll let you know once it&apos;s been looked at.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="name" value={blocked.name} />
          <input type="hidden" name="primaryCategory" value={blocked.primaryCategory} />
          <Field label="Why do you need it?">
            <textarea
              name="reason"
              rows={3}
              required
              minLength={10}
              maxLength={1000}
              placeholder="e.g. a separate studio brand with its own team"
              className={controlClasses}
            />
          </Field>
          {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Sending…" : "Request approval"}
          </Button>
        </form>
      )}
    </Card>
  );
}
