"use client";

import { useOnline } from "@/lib/useOnline";

/**
 * Minimal, reusable offline indicator — not a blanket banner.
 * Render near the action that requires network (e.g., above send button, above grade submit).
 * Preserves Hierarchy Class styling: faint border, warm warning soft bg, centered text.
 */
export function OfflineBanner({ message }: { message?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-2 rounded-[8px] border border-warn-soft bg-warn-soft px-3 py-2 text-xs leading-5 text-warn"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <path d="M1 1l22 22" />
      </svg>
      <span>{message ?? "You’re offline — connect to continue. Your input is saved, but nothing was sent."}</span>
    </div>
  );
}

/**
 * Inline offline dot for headers — shows only when offline.
 */
export function OfflineDot() {
  const online = useOnline();
  if (online) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-soft bg-warn-soft px-2.5 py-1 text-[10px] font-semibold text-warn">
      <span className="h-1.5 w-1.5 rounded-full bg-warn" />
      Offline
    </span>
  );
}
