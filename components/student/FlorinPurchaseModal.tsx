"use client";

import { useFlorin } from "@/lib/florinStore";

const FLORIN_PACKAGES = [
  { florin: 50, price: 39 },
  { florin: 120, price: 79 },
  { florin: 300, price: 179 },
  { florin: 650, price: 349 },
];

// Real Florin balances are tracked in Supabase, but purchases are NOT wired
// to any payment processor yet. This modal deliberately does nothing: no
// fabricated transactions, no fake "purchased" state.
export function FlorinPurchaseModal({ onClose }: { onClose: () => void }) {
  const { balance } = useFlorin();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[10px] border border-base bg-surface p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Buy Florin</p>
        <h2 className="mt-2 text-xl font-bold text-navy">Top up your coins</h2>
        <p className="mt-2 text-sm text-muted">
          Your current balance is <span className="font-semibold text-navy">{balance.toLocaleString()} Florin</span>.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {FLORIN_PACKAGES.map((pkg) => (
            <div key={pkg.florin} className="rounded-[10px] border border-base bg-surface px-3 py-3 text-center opacity-60">
              <p className="text-lg font-bold text-navy">{pkg.florin}</p>
              <p className="text-[11px] text-muted">Florin</p>
              <p className="mt-1 text-xs font-semibold text-gold">₱{pkg.price}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4 text-center">
          <p className="text-sm font-semibold text-navy">Purchases coming soon</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Coin packages aren&apos;t connected to a payment processor yet. Your balance only changes through verified
            school activity - never through this screen.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-on-accent"
        >
          Close
        </button>
      </div>
    </div>
  );
}
