"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useConfirmDialogStore } from "@/lib/stores/confirm-dialog-store";

// Mounted once (in AppShell, alongside ToastContainer), same as any other
// piece of global app chrome — every confirmDialog() call anywhere in the
// app shows up here rather than each call site rendering its own <Modal>.
export function ConfirmDialogHost() {
  const isOpen = useConfirmDialogStore((state) => state.isOpen);
  const title = useConfirmDialogStore((state) => state.title);
  const message = useConfirmDialogStore((state) => state.message);
  const confirmLabel = useConfirmDialogStore((state) => state.confirmLabel);
  const cancelLabel = useConfirmDialogStore((state) => state.cancelLabel);
  const settle = useConfirmDialogStore((state) => state.settle);

  return (
    <Modal open={isOpen} onClose={() => settle(false)} title={title} hideCloseButton>
      <p className="text-sm font-semibold text-text">{message}</p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => settle(false)}>
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={() => settle(true)}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
