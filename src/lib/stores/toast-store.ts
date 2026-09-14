import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: { message: string; variant?: ToastVariant }) => void;
  dismissToast: (id: string) => void;
}

/**
 * A plain global store, unlike the persona store — toasts hold no
 * server-fetched, per-user data at creation time, only ephemeral UI state
 * added client-side after hydration, so there's no cross-request leak risk
 * to design around here.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: ({ message, variant = "default" }) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), message, variant }],
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
