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
    <header className="mb-6 flex items-center justify-between border-b border-base pb-4">
      <div className="min-w-0 xl:hidden">
        <BrandMark href={href} />
      </div>
      <p className="hidden min-w-0 truncate text-sm font-medium text-muted xl:block">
        {schoolName ? `${schoolName} · Hierarchy Class` : "Hierarchy Class"}
      </p>

      <div className="relative flex shrink-0 items-center gap-2">
        {showFlorin && (
          <button
            type="button"
            onClick={() => setBuyOpen(true)}
            title="Buy Florin"
            className="flex items-center gap-2 rounded-md border border-line bg-tile px-2.5 py-1.5 text-[13px] font-semibold text-navy transition hover:border-sealion"
          >
            <CoinIcon size={18} />
            <span>{balance.toLocaleString()} Florin</span>
            <span className="text-[12px] text-faint">+</span>
          </button>
        )}
        <NotificationBell />
      </div>

      {buyOpen && <FlorinPurchaseModal onClose={() => setBuyOpen(false)} />}
    </header>
  );
}
