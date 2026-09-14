"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCaseComment, type CommentState } from "./actions";

const initialState: CommentState = {};

export function CommentForm({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(addCaseComment, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error && !pending) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <Input name="body" placeholder="Add a comment…" required />
      {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending} className="w-fit">
        {pending ? "Posting…" : "Post comment"}
      </Button>
    </form>
  );
}
