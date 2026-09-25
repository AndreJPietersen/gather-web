"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToastStore, type Toast } from "@/lib/stores/toast-store";

const AUTO_DISMISS_MS = 4000;

const variantClasses: Record<Toast["variant"], string> = {
  default: "bg-ink text-white",
  success: "bg-success text-ink",
  error: "bg-primary text-white",
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  return (
    <div
      role="status"
      className={cn("rounded-field px-4 py-3 text-sm font-bold shadow-lg", variantClasses[toast.variant])}
    >
      {toast.message}
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
