"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useAdvanceOnSuccess } from "@/lib/hooks/use-advance-on-success";
import { addTask, type TaskFormState } from "../tasks/actions";
import { createPaymentPlan, type PaymentPlanState } from "../payments/actions";
import {
  addAttendeeForWizard,
  type WizardAttendeeState,
  createBudgetItemForWizard,
  type WizardBudgetItemState,
  addVendorToEventForWizard,
  type WizardVendorState,
} from "./actions";
import type { EventPlanningProgressResult } from "@gather/shared/event-planning-progress";

const TOTAL_STEPS = 5;

function StepDots({ step }: { step: number }) {
  return (
    // pr-9 keeps the last dot clear of the Modal's own close button
    // (absolute, top-4 right-4, 32px square) — without it the dot row runs
    // the full panel width and sits directly under the X.
    <div className="mb-3 flex gap-1.5 pr-9">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-pill ${i < step ? "bg-success" : i === step ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

function StepShell({
  step,
  title,
  subtitle,
  note,
  onSkip,
  onBack,
  nextSlot,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  note?: ReactNode;
  onSkip: () => void;
  onBack?: () => void;
  nextSlot: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <StepDots step={step} />
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
        Step {step + 1} of {TOTAL_STEPS}
      </p>
      <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">{title}</h3>
      {subtitle && <p className="mt-1 text-xs font-semibold text-text-muted">{subtitle}</p>}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
      {note && <div className="mt-3 rounded-[10px] bg-secondary-soft p-2.5 text-[11px] font-bold text-ink">{note}</div>}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onSkip} className="text-xs font-extrabold text-text-muted">
          Skip
        </button>
        <div className="flex items-center gap-3">
          {onBack && (
            <button type="button" onClick={onBack} className="px-1 text-xs font-extrabold text-text-muted">
              Back
            </button>
          )}
          {nextSlot}
        </div>
      </div>
    </div>
  );
}

function AttendeeStep({
  step,
  eventId,
  onDone,
  onSkip,
}: {
  step: number;
  eventId: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [state, formAction, pending] = useActionState<WizardAttendeeState, FormData>(addAttendeeForWizard, {});
  useAdvanceOnSuccess(state, pending, onDone);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <StepShell
        step={step}
        title="Who's coming?"
        subtitle="Add your first guest — you can invite the rest later from Attendees."
        onSkip={onSkip}
        nextSlot={
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Adding…" : "Next"}
          </Button>
        }
      >
        <Input name="name" placeholder="Attendee name" required />
        <Input name="email" type="email" placeholder="Email (optional)" />
        <Field label="Additional guests">
          <Input name="guestCount" type="number" min={0} max={20} defaultValue={0} className="w-24" />
        </Field>
        {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      </StepShell>
    </form>
  );
}

function TaskStep({
  step,
  eventId,
  onDone,
  onSkip,
  onBack,
}: {
  step: number;
  eventId: string;
  onDone: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(addTask, {});
  useAdvanceOnSuccess(state, pending, onDone);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <StepShell
        step={step}
        title="What needs doing?"
        subtitle="One task to start your list — book the venue, send invites, whatever's first."
        onSkip={onSkip}
        onBack={onBack}
        nextSlot={
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Adding…" : "Next"}
          </Button>
        }
      >
        <Input name="title" placeholder="Task (e.g. Book the venue)" required />
        <Field label="Due date (optional)">
          <Input name="dueDate" type="date" />
        </Field>
        {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      </StepShell>
    </form>
  );
}

function BudgetStep({
  step,
  eventId,
  categories,
  onDone,
  onSkip,
  onBack,
}: {
  step: number;
  eventId: string;
  categories: { id: string; name: string }[];
  onDone: (item: { id: string; label: string }) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [state, formAction, pending] = useActionState<WizardBudgetItemState, FormData>(createBudgetItemForWizard, {});
  useAdvanceOnSuccess(state, pending, (s) => {
    if (s.budgetItemId && s.label) onDone({ id: s.budgetItemId, label: s.label });
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <StepShell
        step={step}
        title="What's this going to cost?"
        subtitle="Add one line item to start your budget — the big-ticket thing you already know about."
        onSkip={onSkip}
        onBack={onBack}
        nextSlot={
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Adding…" : "Next"}
          </Button>
        }
      >
        <Input name="label" placeholder="Line item (e.g. Catering)" required />
        <Field label="Category (optional)">
          <select
            name="categoryId"
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <CurrencyInput name="budgetedAmount" placeholder="Budgeted amount (ZAR)" required />
        {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      </StepShell>
    </form>
  );
}

interface AddedVendor {
  eventVendorId: string;
  vendorId: string;
  name: string;
}

function SuggestedVendorRow({
  eventId,
  vendor,
  isAdded,
  onAdded,
}: {
  eventId: string;
  vendor: { id: string; name: string; primary_category: string | null };
  isAdded: boolean;
  onAdded: (v: AddedVendor) => void;
}) {
  const [state, formAction, pending] = useActionState<WizardVendorState, FormData>(addVendorToEventForWizard, {});
  // "Added" is derived from the parent's addedVendors list (via isAdded),
  // not tracked locally — the parent is the one place that already knows
  // every vendor added this session, so a second, row-local copy of the
  // same fact could only ever drift from it, never add information.
  useAdvanceOnSuccess(state, pending, (s) => {
    if (s.eventVendorId) {
      onAdded({ eventVendorId: s.eventVendorId, vendorId: vendor.id, name: vendor.name });
    }
  });

  return (
    <form action={formAction} className="flex items-center gap-2.5 rounded-[14px] border-2 border-border p-2.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorId" value={vendor.id} />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-secondary-soft text-[11px] font-extrabold text-ink">
        {vendor.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-text">{vendor.name}</p>
        {vendor.primary_category && <p className="truncate text-[10px] font-semibold text-text-muted">{vendor.primary_category}</p>}
      </div>
      <Button type="submit" variant="accent" disabled={pending || isAdded} className="px-4 py-2 text-[11px]">
        {isAdded ? "Added ✓" : pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}

function VendorStep({
  step,
  eventId,
  suggestedVendors,
  addedVendorIds,
  onVendorAdded,
  onNext,
  onSkip,
  onBack,
}: {
  step: number;
  eventId: string;
  suggestedVendors: { id: string; name: string; primary_category: string | null }[];
  addedVendorIds: Set<string>;
  onVendorAdded: (v: AddedVendor) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <StepShell
      step={step}
      title="Found someone you like?"
      subtitle="Matched to this event's type — add one to keep going, or browse the full directory."
      onSkip={onSkip}
      onBack={onBack}
      nextSlot={
        <Button type="button" variant="accent" onClick={onNext} disabled={addedVendorIds.size === 0}>
          Next
        </Button>
      }
    >
      {suggestedVendors.length > 0 ? (
        <div className="flex flex-col gap-2">
          {suggestedVendors.map((vendor) => (
            <SuggestedVendorRow
              key={vendor.id}
              eventId={eventId}
              vendor={vendor}
              isAdded={addedVendorIds.has(vendor.id)}
              onAdded={onVendorAdded}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs font-semibold text-text-muted">No matching vendors yet for this event&apos;s type.</p>
      )}
      <LinkButton href="/vendors" variant="secondary" className="text-center">
        Browse all vendors
      </LinkButton>
    </StepShell>
  );
}

function PaymentStep({
  step,
  eventId,
  eventVendor,
  budgetItemOptions,
  onDone,
  onSkip,
  onBack,
}: {
  step: number;
  eventId: string;
  eventVendor: { eventVendorId: string; name: string } | null;
  budgetItemOptions: { id: string; label: string }[];
  onDone: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [state, formAction, pending] = useActionState<PaymentPlanState, FormData>(createPaymentPlan, {});
  useAdvanceOnSuccess(state, pending, onDone);

  if (!eventVendor) {
    return (
      <StepShell
        step={step}
        title="Set up a payment plan"
        subtitle="You'll need a vendor added first — go back to add one, or come back to this later from Payments."
        onSkip={onSkip}
        onBack={onBack}
        nextSlot={
          <Button type="button" variant="accent" onClick={onSkip}>
            Continue
          </Button>
        }
      >
        <p className="text-xs font-semibold text-text-muted">No vendor added yet in this session.</p>
      </StepShell>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="eventVendorId" value={eventVendor.eventVendorId} />
      <input type="hidden" name="eventId" value={eventId} />
      <StepShell
        step={step}
        title="Set up a payment plan"
        subtitle={`For ${eventVendor.name} — no quote yet, so this is your own estimate.`}
        onSkip={onSkip}
        onBack={onBack}
        note={`This is an estimate. Once ${eventVendor.name} sends a real quote, that vendor's own booking page will flag it here if the numbers don't match — nothing's locked in.`}
        nextSlot={
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Creating…" : "Finish"}
          </Button>
        }
      >
        <CurrencyInput name="totalAmount" placeholder="Total amount (ZAR, estimated)" required />
        <CurrencyInput name="depositAmount" placeholder="Deposit amount (optional)" />
        <Field label="Deposit due date (optional)">
          <Input name="depositDueDate" type="date" />
        </Field>
        {budgetItemOptions.length > 0 && (
          <Field label="Attach to a budget line (optional)">
            <select
              name="budgetItemId"
              className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
            >
              <option value="">None</option>
              {budgetItemOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      </StepShell>
    </form>
  );
}

function CompletionScreen({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-success-soft text-2xl">🎉</span>
      <p className="mt-1 font-display text-lg font-semibold text-ink">You&apos;re set up!</p>
      <p className="max-w-[240px] text-xs font-semibold text-text-muted">
        Keep going anytime from Help me plan on this event&apos;s page.
      </p>
      {/* This screen is also what a *reopen* on an already-complete event
          lands on directly (step initializes straight to TOTAL_STEPS), not
          just what finishing the wizard once shows — with no way back to
          any step, that reopen had no path to, say, add a second vendor,
          the exact case the card's own copy elsewhere says is supported. */}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={onBack} className="px-1 text-xs font-extrabold text-text-muted">
          Back
        </button>
        <Button variant="accent" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

export interface HelpMePlanWizardProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  progress: EventPlanningProgressResult;
  budgetCategories: { id: string; name: string }[];
  suggestedVendors: { id: string; name: string; primary_category: string | null }[];
  initialBudgetItems: { id: string; label: string }[];
  initialEventVendor: { id: string; name: string } | null;
}

// Every step reuses a real, existing Server Action's validation and insert
// — either directly (Tasks, Payment Plan, neither of which redirect on
// success) or via the deliberate non-redirecting duplicates in ./actions.ts
// (Attendee, Budget, Vendor, all three of which redirect in their
// standalone-page form, which would tear this modal down mid-flow). The
// wizard's own job is purely sequencing: which step is showing, and
// carrying the vendor/budget-item just created in one step into the next.
export function HelpMePlanWizard({
  open,
  onClose,
  eventId,
  progress,
  budgetCategories,
  suggestedVendors,
  initialBudgetItems,
  initialEventVendor,
}: HelpMePlanWizardProps) {
  // Chosen once, at mount, from whatever's already done — not re-derived on
  // every reopen within the same visit, so closing mid-step and reopening
  // resumes exactly where you left off rather than jumping around as
  // `progress` (a live server value) happens to update in the background.
  const [step, setStep] = useState(() => {
    const firstIncomplete = progress.items.findIndex((item) => !item.done);
    return firstIncomplete === -1 ? TOTAL_STEPS : firstIncomplete;
  });
  const [createdBudgetItem, setCreatedBudgetItem] = useState<{ id: string; label: string } | null>(null);
  const [addedVendors, setAddedVendors] = useState<AddedVendor[]>([]);
  const addedVendorIds = useMemo(() => new Set(addedVendors.map((v) => v.vendorId)), [addedVendors]);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const budgetItemOptions = createdBudgetItem ? [...initialBudgetItems, createdBudgetItem] : initialBudgetItems;
  const paymentEventVendor = addedVendors[0]
    ? { eventVendorId: addedVendors[0].eventVendorId, name: addedVendors[0].name }
    : initialEventVendor
      ? { eventVendorId: initialEventVendor.id, name: initialEventVendor.name }
      : null;

  return (
    <Modal open={open} onClose={onClose}>
      {step === 0 && <AttendeeStep step={0} eventId={eventId} onDone={goNext} onSkip={goNext} />}
      {step === 1 && <TaskStep step={1} eventId={eventId} onDone={goNext} onSkip={goNext} onBack={goBack} />}
      {step === 2 && (
        <BudgetStep
          step={2}
          eventId={eventId}
          categories={budgetCategories}
          onDone={(item) => {
            setCreatedBudgetItem(item);
            goNext();
          }}
          onSkip={goNext}
          onBack={goBack}
        />
      )}
      {step === 3 && (
        <VendorStep
          step={3}
          eventId={eventId}
          suggestedVendors={suggestedVendors}
          addedVendorIds={addedVendorIds}
          onVendorAdded={(v) => setAddedVendors((prev) => [...prev, v])}
          onNext={goNext}
          onSkip={goNext}
          onBack={goBack}
        />
      )}
      {step === 4 && (
        <PaymentStep
          step={4}
          eventId={eventId}
          eventVendor={paymentEventVendor}
          budgetItemOptions={budgetItemOptions}
          onDone={goNext}
          onSkip={goNext}
          onBack={goBack}
        />
      )}
      {step === TOTAL_STEPS && <CompletionScreen onBack={goBack} onClose={onClose} />}
    </Modal>
  );
}
