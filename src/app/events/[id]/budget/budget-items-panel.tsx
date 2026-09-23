"use client";

import { useState, useSyncExternalStore } from "react";
import { AddBudgetItemForm } from "./add-budget-item-form";

interface SuggestedCategory {
  id: string;
  name: string;
}

const SUGGESTIONS_OPEN_STORAGE_KEY = "gather-budget-suggestions-open";

// A minimal external store (the same shape Zustand builds internally, just
// without pulling in the library for one boolean) rather than a
// useEffect-that-calls-setState: useSyncExternalStore is React's actual
// sanctioned way to reconcile a browser-only value like localStorage with
// SSR output — it renders getServerSnapshot's value on both the server and
// the client's first pass (so there's no hydration mismatch to work around
// on this <details>'s `open` attribute), then re-renders once with the
// real stored value from getSnapshot. Module-level, not per-component
// state, same "gather-*" localStorage-key convention theme-store.ts uses.
const suggestionsOpenListeners = new Set<() => void>();
let cachedSuggestionsOpen: boolean | null = null;

function readStoredSuggestionsOpen(): boolean {
  try {
    const stored = window.localStorage.getItem(SUGGESTIONS_OPEN_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true; // private browsing / storage disabled — defaults open
  }
}

function getSuggestionsOpenSnapshot(): boolean {
  if (cachedSuggestionsOpen === null) cachedSuggestionsOpen = readStoredSuggestionsOpen();
  return cachedSuggestionsOpen;
}

function getSuggestionsOpenServerSnapshot(): boolean {
  return true; // always expanded in the server-rendered HTML
}

function subscribeSuggestionsOpen(listener: () => void): () => void {
  suggestionsOpenListeners.add(listener);
  return () => suggestionsOpenListeners.delete(listener);
}

function setSuggestionsOpenPreference(next: boolean): void {
  cachedSuggestionsOpen = next;
  try {
    window.localStorage.setItem(SUGGESTIONS_OPEN_STORAGE_KEY, String(next));
  } catch {
    // Preference just won't persist this visit — not worth surfacing.
  }
  suggestionsOpenListeners.forEach((listener) => listener());
}

// Groups the suggestion chips with the Add form so tapping a suggestion can
// prefill it — plain server-rendered suggestions (like the Vendors page's
// "Suggested Vendors") can't do this themselves, and unlike a suggested
// vendor, a suggested category can't just be inserted on tap: budget_items.
// budgeted_amount is NOT NULL, and there's no "typical price" anywhere in
// the schema to seed it with, so the planner always has to supply that
// themselves.
export function BudgetItemsPanel({
  eventId,
  categories,
  suggestedCategories,
}: {
  eventId: string;
  categories: { id: string; name: string }[];
  suggestedCategories: SuggestedCategory[];
}) {
  const [prefill, setPrefill] = useState<SuggestedCategory | null>(null);
  // Forces AddBudgetItemForm to remount on every tap, even a repeat tap of
  // the same chip after clearing the form — defaultValue only applies on
  // mount, so without a fresh key a second tap of the same suggestion
  // wouldn't refocus the amount field or restore a label the planner edited.
  const [tapCount, setTapCount] = useState(0);
  // Defaults open — a planner who never touches it should still see the
  // suggestions once. Someone who collapses it (because they know what they
  // need and don't want the nudge) has that choice remembered on this
  // device.
  const suggestionsOpen = useSyncExternalStore(
    subscribeSuggestionsOpen,
    getSuggestionsOpenSnapshot,
    getSuggestionsOpenServerSnapshot,
  );

  return (
    <div className="flex flex-col gap-3">
      {suggestedCategories.length > 0 && (
        <details
          open={suggestionsOpen}
          onToggle={(e) => setSuggestionsOpenPreference(e.currentTarget.open)}
          className="group rounded-[22px] bg-surface p-4 shadow-[0_6px_16px_-8px_var(--color-ink)]"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 marker:content-none">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Suggested for this event</h2>
              <p className="text-xs font-semibold text-text-muted">Typical for this event type — tap to add one.</p>
            </div>
            <span className="shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setPrefill(category);
                  setTapCount((n) => n + 1);
                }}
                className="rounded-pill border-2 border-border bg-surface px-3 py-1.5 text-xs font-extrabold text-text transition-colors active:bg-primary-soft active:text-primary"
              >
                + {category.name}
              </button>
            ))}
          </div>
        </details>
      )}

      <AddBudgetItemForm
        key={tapCount}
        eventId={eventId}
        categories={categories}
        prefillLabel={prefill?.name}
        prefillCategoryId={prefill?.id}
      />
    </div>
  );
}
