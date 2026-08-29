"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/ui/icons";
import { registerBackHandler } from "@/lib/nativeBackHandler";

/**
 * Shared modal shell, matching the PostEditor visual language: dimmed
 * backdrop (click to close), surface panel with the gold hairline accent and
 * a mono eyebrow, close button, and the app's entrance animation.
 *
 * The overlay is rendered through a portal to `document.body` so it is always
 * centered on the browser viewport. This is required because `position:
 * fixed` descendants are positioned relative to the nearest ancestor with a
 * transform/filter/backdrop-filter containing block - and the student shell's
 * `.glass-cards` surfaces apply `backdrop-filter: blur(...)`, which would
 * otherwise anchor modals opened inside a card to that card's box instead of
 * the viewport.
 */
export interface ModalProps {
  onClose: () => void;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  /**
   * "center" (default) keeps the existing centered dialog at every width.
   * "sheet" anchors the panel to the bottom of the viewport on phones
   * (< sm, thumb-reachable one-hand position) and falls back to the same
   * centered dialog from sm up, so tablets/desktops are unchanged.
   */
  align?: "center" | "sheet";
  /** Accessible name announced by screen readers when the dialog opens. */
  ariaLabel?: string;
}

export function Modal({ onClose, eyebrow, description, children, maxWidth = "max-w-lg", align = "center", ariaLabel }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Escape closes the dialog and focus moves into it on open. Without this,
  // keyboard/Switch Access users could be trapped behind the overlay.
  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    // Android hardware back closes the dialog before any navigation happens
    // (the global native backButton listener consults this registry first).
    // Inert on the web, where nothing consumes the registry.
    const unregister = registerBackHandler(() => {
      onClose();
      return true;
    });
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unregister();
    };
  }, [mounted, onClose]);

  // Modals only ever render after a user interaction, but the guard keeps the
  // portal from touching `document` during server rendering.
  if (!mounted) return null;

  const isSheet = align === "sheet";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-black/50 p-4 ${
        isSheet ? "items-end sm:items-center" : "items-center"
      }`}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`animate-modal-in max-h-[90vh] w-full ${maxWidth} overflow-y-auto overscroll-contain rounded-[10px] border border-base bg-surface p-6 outline-none`}
        style={{ maxHeight: "min(90vh, 90dvh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {(eyebrow || description) && (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {eyebrow && (
                <>
                  <div className="mb-3 h-1 w-10 rounded-full bg-gold-token" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-token">{eyebrow}</p>
                </>
              )}
              {description && <p className="mt-1 text-[11px] leading-5 text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center -mr-2 -mt-1 touch-manipulation text-muted transition hover:text-navy max-[767px]:h-11 max-[767px]:w-11"
            >
              <IconX size={14} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
