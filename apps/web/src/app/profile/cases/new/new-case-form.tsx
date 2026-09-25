"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { compressImageFile } from "@/lib/image-compression";
import { SUPPORT_CASE_CATEGORIES } from "@gather/shared/support-case-categories";
import { createSupportCase, type NewSupportCaseState } from "./actions";

const initialState: NewSupportCaseState = {};

export function NewCaseForm() {
  const [isCompressing, setIsCompressing] = useState(false);

  // Same "compress inside the action passed to useActionState" shape as
  // AddGalleryImageForm — doing it in a wrapper that calls the dispatcher
  // manually breaks React's transition tracking for `pending`.
  const [state, formAction, pending] = useActionState(async (_prevState: NewSupportCaseState, formData: FormData) => {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      setIsCompressing(true);
      formData.set("file", await compressImageFile(file));
      setIsCompressing(false);
    }
    return createSupportCase(_prevState, formData);
  }, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <Field label="What's this about?">
          <select
            name="category"
            required
            defaultValue=""
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text"
          >
            <option value="" disabled>
              Choose a category
            </option>
            {SUPPORT_CASE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tell us what's going on">
          <textarea
            name="description"
            placeholder="Describe the issue — what happened, and what you expected instead."
            required
            rows={5}
            className="rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text placeholder:font-semibold placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </Field>

        <Field label="Add a screenshot (optional)">
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Attach a screenshot"
            className="text-sm font-semibold text-text-muted file:mr-3 file:rounded-pill file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-primary"
          />
        </Field>

        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending || isCompressing}>
          {isCompressing ? "Compressing…" : pending ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </Card>
  );
}
