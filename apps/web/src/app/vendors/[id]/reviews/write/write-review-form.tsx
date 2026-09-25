"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { upsertReview, type ReviewFormState } from "../actions";

const RATING_LABELS: Record<number, string> = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Great", 5: "Excellent" };

const initialState: ReviewFormState = {};

export function WriteReviewForm({
  vendorId,
  eventVendorId,
  initialRating,
  initialText,
}: {
  vendorId: string;
  eventVendorId: string;
  initialRating: number;
  initialText: string;
}) {
  const [state, formAction, pending] = useActionState(upsertReview, initialState);
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || rating;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="eventVendorId" value={eventVendorId} />
      <input type="hidden" name="rating" value={rating} />

      <Card className="flex flex-col gap-2.5">
        <p className="text-[13px] font-extrabold text-text">Your rating</p>
        <div className="flex gap-2" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill={n <= displayRating ? "var(--color-secondary)" : "var(--color-border)"}>
                <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2" />
              </svg>
            </button>
          ))}
        </div>
        {displayRating > 0 && <p className="text-xs font-extrabold text-text">{RATING_LABELS[displayRating]}</p>}
      </Card>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reviewText" className="text-xs font-extrabold text-text-muted">
          Your review
        </label>
        <textarea
          id="reviewText"
          name="reviewText"
          defaultValue={initialText}
          rows={5}
          maxLength={1000}
          placeholder="Share how working with them went — communication, quality, would you book them again?"
          className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text placeholder:font-semibold placeholder:text-text-muted focus:border-primary focus:outline-none"
        />
        <p className="text-[11px] font-semibold text-text-muted">
          Visible to other planners on this vendor&apos;s profile. You can edit it later.
        </p>
      </div>

      {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}

      <Button type="submit" disabled={pending || rating === 0} className="w-full">
        {pending ? "Posting…" : "Post Review"}
      </Button>
    </form>
  );
}
