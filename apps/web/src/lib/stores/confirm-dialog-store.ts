import { create } from "zustand";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmDialogState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((confirmed: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
}

const DEFAULT_CONFIRM_LABEL = "Continue";
const DEFAULT_CANCEL_LABEL = "Cancel";

// A plain global store, same reasoning as toast-store.ts: this holds
// ephemeral, client-only UI state (which confirmation is currently showing),
// never per-user server data, so there's nothing request-specific to leak
// across users during SSR.
export const useConfirmDialogStore = create<ConfirmDialogState>((set, get) => ({
  isOpen: false,
  title: undefined,
  message: "",
  confirmLabel: DEFAULT_CONFIRM_LABEL,
  cancelLabel: DEFAULT_CANCEL_LABEL,
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      // Resolves any prompt still hanging around unanswered (shouldn't
      // normally happen — this app only ever opens one confirm at a time —
      // but a stray promise that's never resolved is a real, silent leak,
      // so a new request always settles whatever it's replacing first.
      get().resolve?.(false);
      set({
        isOpen: true,
        resolve,
        confirmLabel: DEFAULT_CONFIRM_LABEL,
        cancelLabel: DEFAULT_CANCEL_LABEL,
        ...options,
      });
    }),
  settle: (confirmed) => {
    get().resolve?.(confirmed);
    set({ isOpen: false, resolve: null });
  },
}));

// The window.confirm() replacement — callable from anywhere (a plain click
// handler, a Link's onNavigate) without the caller needing to render
// anything itself. Unlike window.confirm(), this is async: `await` it.
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmDialogStore.getState().request(options);
}
