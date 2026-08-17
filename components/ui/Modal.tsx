"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/ui/icons";

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
}

export function Modal({ onClose, eyebrow, description, children, maxWidth = "max-w-lg" }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Modals only ever render after a user interaction, but the guard keeps the
  // portal from touching `document` during server rendering.
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`animate-modal-in max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[10px] border border-base bg-surface p-6`}
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
              className="shrink-0 text-muted transition hover:text-navy"
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
