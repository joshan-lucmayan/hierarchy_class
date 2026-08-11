"use client";

import { useState } from "react";
import { BrandMark } from "@/components/navigation/BrandMark";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { useBanner } from "@/lib/bannerStore";
import { useFlorin } from "@/lib/florinStore";
import { FlorinPurchaseModal } from "@/components/student/FlorinPurchaseModal";

export function SiteHeader({ href, showFlorin }: { href?: string; showFlorin?: boolean }) {
  const { imageUrl, focalY } = useBanner();
  const { balance } = useFlorin();
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  return (
    <header className="relative mb-4 flex items-center justify-between rounded-2xl border border-base bg-surface px-5 py-3">
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `center ${focalY}%` }}
        />
        <div className="absolute inset-0 bg-navy/30" />
      </div>

      <div className="relative xl:hidden">
        <BrandMark href={href} />
      </div>
      <div className="relative hidden xl:block" />
      <div className="relative flex items-center gap-2">
        {showFlorin && (
          <button
            type="button"
            onClick={() => setPurchaseOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-black/45 py-1.5 pl-1.5 pr-3 backdrop-blur transition hover:bg-black/60"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-[#f6d989] to-[#c9962c] shadow-inner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a3b12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v10M15.5 9.5a2.5 2.5 0 00-3.5-2.3M8.5 14.5a2.5 2.5 0 003.5 2.3" />
              </svg>
            </span>
            <span className="text-xs font-bold text-white">{balance.toLocaleString()}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">Florin</span>
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">+</span>
          </button>
        )}
        <NotificationBell />
      </div>

      {purchaseOpen && <FlorinPurchaseModal onClose={() => setPurchaseOpen(false)} />}
    </header>
  );
}
