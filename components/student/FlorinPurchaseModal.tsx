"use client";

import { useState } from "react";
import { useFlorin } from "@/lib/florinStore";

const FLORIN_PACKAGES = [
  { florin: 50, price: 39 },
  { florin: 120, price: 79 },
  { florin: 300, price: 179 },
  { florin: 650, price: 349 },
];

export function FlorinPurchaseModal({ onClose }: { onClose: () => void }) {
  const { addFlorin } = useFlorin();
  const [selected, setSelected] = useState(FLORIN_PACKAGES[1].florin);
  const [purchased, setPurchased] = useState(false);

  function handlePurchase() {
    addFlorin(selected);
    setPurchased(true);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {purchased ? (
          <div className="text-center">
            <p className="text-3xl">🪙</p>
            <p className="mt-3 text-lg font-bold text-navy">{selected} Florin added!</p>
            <p className="mt-2 text-sm text-muted">
              This is a UI preview only - Florin purchases aren&apos;t connected to real payments yet.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Buy Florin</p>
            <h2 className="mt-2 text-xl font-bold text-navy">Top up your coins</h2>
            <p className="mt-2 text-sm text-muted">Choose a Florin package. Use it to gift charisma to classmates.</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {FLORIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.florin}
                  type="button"
                  onClick={() => setSelected(pkg.florin)}
                  className={`rounded-2xl border px-3 py-3 text-center transition ${
                    selected === pkg.florin ? "border-gold bg-[var(--surface-strong)]" : "border-base bg-surface hover:border-gold"
                  }`}
                >
                  <p className="text-lg font-bold text-navy">{pkg.florin}</p>
                  <p className="text-[11px] text-muted">Florin</p>
                  <p className="mt-1 text-xs font-semibold text-gold">₱{pkg.price}</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePurchase}
              className="mt-5 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-navy transition hover:opacity-90"
            >
              Buy {selected} Florin
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-full border border-base py-2.5 text-sm font-semibold text-navy transition hover:border-gold"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
