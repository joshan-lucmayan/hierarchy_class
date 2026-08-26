"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/navigation/BrandMark";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { useFlorin } from "@/lib/florinStore";
import { useSchools } from "@/lib/useSchools";
import { CoinIcon } from "@/components/ui/CoinIcon";
import { FlorinPurchaseModal } from "@/components/student/FlorinPurchaseModal";

export function SiteHeader({ href, showFlorin }: { href?: string; showFlorin?: boolean }) {
  const { balance } = useFlorin();
  const { schools } = useSchools();
  const [buyOpen, setBuyOpen] = useState(false);

  const schoolName = schools[0]?.name;

  return (
    <header
      className="max-xl:sticky max-xl:top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-base bg-surface px-4 pb-3 pt-3 sm:-mx-6 sm:mb-6 sm:px-6 xl:mx-0 xl:px-0"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="min-w-0 shrink-0 xl:hidden">
        <BrandMark href={href} />
      </div>
      <p className="hidden min-w-0 flex-1 truncate text-sm font-medium text-muted xl:block">
        {schoolName ? `${schoolName} · Hierarchy Class` : "Hierarchy Class"}
      </p>

      <div className="relative flex min-w-0 shrink-0 items-center gap-2">
        {showFlorin && (
          <button
            type="button"
            onClick={() => setBuyOpen(true)}
            title="Buy Florin"
            className="flex max-w-[160px] items-center gap-1.5 rounded-md border border-line bg-tile px-2.5 py-1.5 text-[13px] font-semibold text-navy transition hover:border-sealion max-[767px]:min-h-[44px] sm:max-w-none sm:gap-2"
          >
            <CoinIcon size={18} />
            <span className="truncate">
              <span className="sm:hidden">{balance.toLocaleString()}</span>
              <span className="hidden sm:inline">{balance.toLocaleString()} Florin</span>
            </span>
            <span className="shrink-0 text-[12px] text-faint">+</span>
          </button>
        )}
        <NotificationBell />
      </div>

      {buyOpen && <FlorinPurchaseModal onClose={() => setBuyOpen(false)} />}
    </header>
  );
}
