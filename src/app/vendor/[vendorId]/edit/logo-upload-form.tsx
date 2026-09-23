"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { compressImageFile } from "@/lib/image-compression";
import { uploadVendorLogo, type LogoUploadState } from "./actions";

const initialState: LogoUploadState = {};

// Sits above EditVendorForm on the edit page — a deliberate visual split
// (photo vs. text fields) even though both write to the same vendors row,
// since a file input and a save-everything form don't mix well as one
// <form>. Same compress-inside-the-action shape AddGalleryImageForm
// established (compressing in a wrapper that calls the dispatcher manually
// breaks React's transition tracking for `pending`).
export function LogoUploadForm({ vendorId, logoUrl }: { vendorId: string; logoUrl: string | null }) {
  const [isCompressing, setIsCompressing] = useState(false);

  const [state, formAction, pending] = useActionState(async (_prevState: LogoUploadState, formData: FormData) => {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      setIsCompressing(true);
      formData.set("file", await compressImageFile(file));
      setIsCompressing(false);
    }
    return uploadVendorLogo(_prevState, formData);
  }, initialState);

  return (
    <Card className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a
          // Storage public URL isn't a static/optimizable asset next/image
          // can source-check at build time.
          <img src={logoUrl} alt="Business logo" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-lg font-semibold text-primary">?</span>
        )}
      </div>
      <form action={formAction} className="flex min-w-0 flex-1 flex-col gap-2">
        <input type="hidden" name="vendorId" value={vendorId} />
        <p className="text-xs font-extrabold text-text-muted">Logo / profile photo</p>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Upload a logo or profile photo"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="text-xs font-semibold text-text-muted file:mr-2 file:rounded-pill file:border-0 file:bg-primary-soft file:px-2 file:py-1 file:text-[11px] file:font-extrabold file:text-primary"
        />
        {(pending || isCompressing) && <p className="text-[11px] font-semibold text-text-muted">Uploading…</p>}
        {state.error && <p className="text-[11px] font-semibold text-primary">{state.error}</p>}
      </form>
    </Card>
  );
}
