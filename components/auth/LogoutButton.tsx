"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";

/**
 * Shared sign-out control for every role: a quiet trigger plus a bottom-sheet
 * confirmation on phones / centered dialog on larger screens. Signing out
 * reuses the existing Supabase browser session and mirrors SideNav's
 * desktop behavior - a full-page navigation to "/" so no authenticated React
 * state survives (the landing page shows signed-out content and middleware
 * guards the role prefixes).
 */
export function LogoutButton({
  label = "Log out",
  variant = "outline",
}: {
  label?: string;
  variant?: "outline" | "danger" | "ghost";
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // Full reload: clears in-memory stores/caches and makes back navigation
      // re-request protected routes from the server (which redirects).
      window.location.href = "/";
    } catch {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full border border-base bg-surface px-4 py-2.5 text-xs font-semibold text-warn transition hover-bg-warn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoggingOut}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        {label}
      </button>

      {confirmOpen && (
        <Modal
          align="sheet"
          maxWidth="max-w-md"
          ariaLabel="Sign out of Hierarchy Class"
          onClose={() => {
            if (!isLoggingOut) setConfirmOpen(false);
          }}
        >
          <div className="mx-auto mb-4 mt-1 h-1 w-10 rounded-full bg-gold-token sm:hidden" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-token">Log out</p>
          <h2 className="mt-2 text-xl font-bold text-navy">Sign out of Hierarchy Class?</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            You will need to sign in again to continue tracking progress, messages, and materials on this device.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={isLoggingOut}
              className="min-h-[44px] flex-1 rounded-full border border-base bg-surface px-4 py-2.5 text-sm font-semibold text-navy transition hover-border-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Confirm sign out of Hierarchy Class"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover-bg-gold-token hover:text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] touch-manipulation"
            >
              {isLoggingOut && (
                <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              Log out
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
