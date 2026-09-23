"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  hideCloseButton?: boolean;
  className?: string;
}

// The one reusable dialog primitive for the app — chrome (backdrop, panel,
// title, close button, focus/scroll handling) only. What goes inside is up
// to the caller: a confirm prompt's message + buttons (see
// confirm-dialog-host.tsx, built on this), a form, a details view, etc.
//
// Portaled to document.body rather than rendered in place: any animated
// ancestor (Card, Button, the tab bar's active-pill — anything using
// `motion.*`) creates a CSS containing block the instant it has an active
// `transform`, which breaks `position: fixed` centering for anything
// nested inside it. Escaping to the body sidesteps that entirely instead of
// depending on no ancestor ever animating between here and the root.
export function Modal({ open, onClose, title, children, hideCloseButton, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the panel itself, not a specific control inside it — this modal
    // has no single obvious default action (a confirm dialog's Cancel and
    // Confirm are equally valid first stops), so landing focus on the
    // panel and letting Tab reach whichever control the user wants avoids
    // silently pre-selecting one for them.
    panelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  // No `mounted` state needed to delay this until after hydration: a
  // portal's children render into `document.body`, entirely outside this
  // component's own position in the tree, so React never tries to hydrate-
  // match them against server output the way it would a normal returned
  // element. All that's needed is not touching `document` while it's
  // genuinely absent (server-side).
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            aria-hidden
            onClick={onClose}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "relative w-full max-w-sm rounded-[22px] bg-surface p-5 shadow-[0_20px_40px_-12px_var(--color-ink)] focus:outline-none",
              className,
            )}
          >
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-primary-soft hover:text-primary"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            )}
            {title && (
              <h2 id={titleId} className="mb-2 pr-8 font-display text-xl font-semibold text-ink">
                {title}
              </h2>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
