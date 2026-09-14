"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fireSuccessConfetti } from "@/lib/confetti";
import { acceptQuote, type AcceptQuoteState } from "./actions";

const initialState: AcceptQuoteState = {};

export function AcceptQuoteForm({
  quoteId,
  eventId,
  eventVendorId,
}: {
  quoteId: string;
  eventId: string;
  eventVendorId: string;
}) {
  const [state, formAction, pending] = useActionState(acceptQuote, initialState);
  const router = useRouter();

  // router.refresh() here, not revalidatePath() inside the action itself —
  // this is what actually closes the staleness this action's own comment
  // used to accept as a tradeoff. A client-triggered refresh runs *after*
  // useActionState has already committed {success: true} from the action's
  // response, so it can't clobber that value the way bundling a
  // server-triggered re-render into the action's own response did (the
  // original Phase 4 bug this file's history was working around). Without
  // this, the sibling Decline button (rendered by the parent page from the
  // now-stale quote.status) stayed live after an accept and could revert it
  // — found in code review, not hypothetical.
  useEffect(() => {
    if (state.success) {
      fireSuccessConfetti();
      router.refresh();
    }
  }, [state.success, router]);

  if (state.success) {
    return <p className="flex-1 text-center text-xs font-extrabold text-success">Accepted!</p>;
  }

  return (
    <form action={formAction} className="flex-1">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventVendorId" value={eventVendorId} />
      {state.error && <p className="mb-1 text-xs font-semibold text-primary">{state.error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Accepting…" : "Accept"}
      </Button>
    </form>
  );
}
