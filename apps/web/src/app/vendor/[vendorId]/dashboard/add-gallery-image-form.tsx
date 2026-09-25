"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { compressImageFile } from "@/lib/image-compression";
import { uploadVendorGalleryImage, type GalleryUploadState } from "./actions";

const initialState: GalleryUploadState = {};

export function AddGalleryImageForm({ vendorId }: { vendorId: string }) {
  const [isCompressing, setIsCompressing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // The compression step lives inside the action passed to useActionState
  // itself, not in a wrapper around the returned `formAction` dispatcher —
  // calling that dispatcher manually from another async function (the
  // first version of this form) fires outside the transition React sets up
  // around a real form submission, which breaks `pending` tracking (a
  // console warning caught this: "useActionState was called outside of a
  // transition").
  const [state, formAction, pending] = useActionState(async (_prevState: GalleryUploadState, formData: FormData) => {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      setIsCompressing(true);
      formData.set("file", await compressImageFile(file));
      setIsCompressing(false);
    }
    const result = await uploadVendorGalleryImage(_prevState, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-label="Choose a photo to upload"
          className="text-sm font-semibold text-text-muted file:mr-3 file:rounded-pill file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-primary"
        />
        <Input name="caption" placeholder="Caption (optional)" />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending || isCompressing}>
          {isCompressing ? "Compressing…" : pending ? "Uploading…" : "Upload photo"}
        </Button>
      </form>
    </Card>
  );
}
