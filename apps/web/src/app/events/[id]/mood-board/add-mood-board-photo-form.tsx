"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { compressImageFile } from "@/lib/image-compression";
import { uploadMoodBoardPhoto, type MoodBoardPhotoUploadState } from "./actions";

const initialState: MoodBoardPhotoUploadState = {};
const FILE_INPUT_ID = "mood-board-photo-file";

// Same shape as AddGalleryImageForm — the compression step has to live
// inside the action passed to useActionState itself, not a wrapper that
// calls the returned dispatcher manually, or React's transition tracking
// for `pending` breaks.
//
// isEmpty renders the "no photos yet" message as a tappable card wired to
// the file input via a real <label htmlFor>, not a plain Card sitting next
// to a separate "Choose File" control — the same "an empty state with an
// obvious add action should be tappable, not decorative" rule this app's
// other empty states already follow, just via a label instead of a Link
// since adding a photo happens inline on this page rather than on its own
// route.
export function AddMoodBoardPhotoForm({ eventId, isEmpty }: { eventId: string; isEmpty: boolean }) {
  const [isCompressing, setIsCompressing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(async (_prevState: MoodBoardPhotoUploadState, formData: FormData) => {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      setIsCompressing(true);
      formData.set("file", await compressImageFile(file));
      setIsCompressing(false);
    }
    const result = await uploadMoodBoardPhoto(_prevState, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      {isEmpty && (
        <label
          htmlFor={FILE_INPUT_ID}
          className="block cursor-pointer rounded-[18px] bg-surface p-4 shadow-[0_6px_16px_-8px_var(--color-ink)]"
        >
          <p className="text-sm font-semibold text-text-muted">No photos yet — tap to add one.</p>
        </label>
      )}
      <input
        id={FILE_INPUT_ID}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        aria-label="Choose a photo to add"
        className="text-xs font-semibold text-text-muted file:mr-3 file:rounded-pill file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-primary"
      />
      {state.error && <p className="text-xs font-semibold text-primary">{state.error}</p>}
      <Button type="submit" variant="accent" disabled={pending || isCompressing} className="text-xs">
        {isCompressing ? "Compressing…" : pending ? "Adding…" : "Add photo"}
      </Button>
    </form>
  );
}
