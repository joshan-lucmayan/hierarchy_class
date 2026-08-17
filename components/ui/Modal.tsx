"use client";

import { IconX } from "@/components/ui/icons";

/**
 * Shared modal shell, matching the PostEditor visual language: dimmed
 * backdrop (click to close), surface panel with the gold hairline accent and
 * a mono eyebrow, close button, and the app's entrance animation.
 *
 * PostEditor now renders through this shell; future admin dialogs should use
 * it too instead of hand-rolling overlays.
 */
export interface ModalProps {
  onClose: () => void;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ onClose, eyebrow, description, children, maxWidth = "max-w-lg" }: ModalProps) {
  return (
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
    </div>
  );
}
