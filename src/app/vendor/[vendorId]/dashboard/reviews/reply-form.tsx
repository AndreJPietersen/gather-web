"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { replyToReview, type ReplyFormState } from "./actions";

const initialState: ReplyFormState = {};

// Two states in one component: no reply yet opens straight into the
// composer (nothing to collapse), an existing reply starts collapsed
// behind an "Edit" link. The parent (dashboard/reviews/page.tsx) keys this
// component on the reply's own text, not just the review id — after a
// successful post, router.refresh() fetches the fresh reply, the key
// changes, and React remounts this component from scratch with the new
// `existingReply` collapsed correctly. That's what lets the effect below
// only ever call router.refresh() (matching notification-preferences-
// form.tsx's own plain-refresh pattern) instead of also setState-ing
// `editing` itself back to false, which would trip this project's
// react-hooks/set-state-in-effect rule — see ReminderChecker's own comment
// on the same rule for why that matters here.
export function ReplyForm({
  vendorId,
  reviewId,
  existingReply,
}: {
  vendorId: string;
  reviewId: string;
  existingReply: string | null;
}) {
  const [state, formAction, pending] = useActionState(replyToReview, initialState);
  const [editing, setEditing] = useState(existingReply === null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (!editing) {
    return (
      <div className="ml-5 mt-1 rounded-[14px] bg-primary-soft px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-extrabold text-primary">Your reply</p>
          <button type="button" onClick={() => setEditing(true)} className="text-[11px] font-extrabold text-primary">
            Edit
          </button>
        </div>
        <p className="text-xs font-semibold text-text">{existingReply}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="ml-5 flex flex-col gap-2">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <textarea
        name="replyText"
        defaultValue={existingReply ?? ""}
        rows={3}
        maxLength={1000}
        placeholder="Write a public reply…"
        className="rounded-[14px] border-2 border-primary-soft bg-surface px-3 py-2.5 text-xs font-semibold text-text placeholder:font-semibold placeholder:text-text-muted focus:border-primary focus:outline-none"
      />
      {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      <div className="flex items-center justify-end gap-2">
        {existingReply !== null && (
          <button type="button" onClick={() => setEditing(false)} className="text-xs font-extrabold text-text-muted">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
        >
          {pending ? "Posting…" : existingReply !== null ? "Save Reply" : "Post Reply"}
        </button>
      </div>
    </form>
  );
}
