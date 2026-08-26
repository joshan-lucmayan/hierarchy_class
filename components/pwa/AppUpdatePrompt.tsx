"use client";

import { Button } from "@/components/ui/Button";

/**
 * Global "New version available" prompt.
 *
 * UPDATE = refresh the running web app to the newest deployment.
 * This is deliberately unrelated to PWA INSTALL prompts — never mix them.
 *
 * Placement: bottom sheet above the BottomNav on phones/tablets (safe-area
 * aware), floating card bottom-right on desktop. z-[60] sits above modals
 * (z-50) and the bottom navs (z-20).
 */
export function AppUpdatePrompt({
  open,
  busy,
  onUpdate,
  onDismiss,
}: {
  open: boolean;
  busy: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="hc-update-title"
      aria-describedby="hc-update-desc"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-[10px] border border-gold-soft bg-surface p-3.5 shadow-xl sm:inset-x-4 md:inset-x-auto md:bottom-6 md:right-6 md:max-w-sm md:p-4"
    >
      <div className="min-w-0">
        <p id="hc-update-title" className="text-sm font-semibold text-navy">
          New version available
        </p>
        <p id="hc-update-desc" className="mt-0.5 text-xs text-muted">
          Hierarchy Class has been updated. Refresh to get the latest changes.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onDismiss} disabled={busy}>
          Later
        </Button>
        <Button variant="primary" size="sm" onClick={onUpdate} disabled={busy} loading={busy}>
          {busy ? "Updating…" : "Update"}
        </Button>
      </div>
    </div>
  );
}
