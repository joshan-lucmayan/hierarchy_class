/**
 * FlorinPurchaseModal
 *
 * Modal for topping up Florin. Online payments are TEMPORARILY DISABLED
 * (lib/paymentsConfig.ts is the single switch): the modal shows a
 * "coming soon" state with the current balance and no purchase path. The
 * /api/payments routes refuse with 503 in lockstep, so there is nothing to
 * double-submit against even if a stale client tries.
 */

"use client";

import { useEffect, useCallback } from "react";
import { useFlorin } from "@/lib/florinStore";
import { registerBackHandler } from "@/lib/nativeBackHandler";

export function FlorinPurchaseModal({ onClose }: { onClose: () => void }) {
  const { balance } = useFlorin();

  const handleClose = useCallback(() => onClose(), [onClose]);

  // Android hardware back closes the modal before any navigation happens.
  useEffect(() => {
    return registerBackHandler(() => {
      handleClose();
      return true;
    });
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-[10px] border border-base bg-surface p-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-accent" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Buy Florin</p>
        <h2 className="mt-2 text-xl font-bold text-navy">Coming soon</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Top-ups are temporarily unavailable while we work on payments.
          Your current balance of{" "}
          <span className="font-semibold text-navy">{balance.toLocaleString()} Florin</span>{" "}
          is safe - check back soon.
        </p>

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="mt-6 w-full rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-accent min-h-[44px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
