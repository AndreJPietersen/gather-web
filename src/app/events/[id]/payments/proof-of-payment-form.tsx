"use client";

import { useActionState, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { compressImageFile } from "@/lib/image-compression";
import { removeProofOfPayment, uploadProofOfPayment, type ProofOfPaymentState } from "./actions";

const initialState: ProofOfPaymentState = {};

// Attached per-installment (see the schema comment on
// payment_installments.proof_of_payment_path) — this control renders
// wherever an installment row has one already (a "View proof" link plus an
// editor-only remove) or doesn't yet (an editor-only upload form). Mirrors
// AddGalleryImageForm's compress-then-upload shape, but accepts PDFs too,
// which compressImageFile already safely no-ops for.
export function ProofOfPaymentForm({
  installmentId,
  eventId,
  proofUrl,
  storagePath,
  isEditor,
}: {
  installmentId: string;
  eventId: string;
  proofUrl: string | null;
  storagePath: string | null;
  isEditor: boolean;
}) {
  const [isCompressing, setIsCompressing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(async (_prevState: ProofOfPaymentState, formData: FormData) => {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      setIsCompressing(true);
      formData.set("file", await compressImageFile(file));
      setIsCompressing(false);
    }
    const result = await uploadProofOfPayment(_prevState, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  if (proofUrl) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase text-text-muted">Proof of payment:</span>
        <a
          href={proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-extrabold text-primary underline"
        >
          <FileText size={12} strokeWidth={3} />
          View
        </a>
        {isEditor && storagePath && (
          <form action={removeProofOfPayment}>
            <input type="hidden" name="installmentId" value={installmentId} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="storagePath" value={storagePath} />
            <button type="submit" className="text-[10px] font-extrabold text-text-muted underline">
              Remove
            </button>
          </form>
        )}
      </div>
    );
  }

  if (!isEditor) return null;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="installmentId" value={installmentId} />
      <input type="hidden" name="eventId" value={eventId} />
      <span className="text-[10px] font-extrabold uppercase text-text-muted">Proof of payment</span>
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        aria-label="Attach proof of payment"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-[10px] font-semibold text-text-muted file:mr-2 file:rounded-pill file:border-0 file:bg-primary-soft file:px-2 file:py-1 file:text-[10px] file:font-extrabold file:text-primary"
      />
      {(pending || isCompressing) && <p className="text-[10px] font-semibold text-text-muted">Uploading…</p>}
      {state.error && <p className="text-[10px] font-semibold text-primary">{state.error}</p>}
    </form>
  );
}
