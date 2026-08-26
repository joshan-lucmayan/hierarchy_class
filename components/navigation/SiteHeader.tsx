"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BrandMark } from "@/components/navigation/BrandMark";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { MobileDrawer } from "@/components/navigation/MobileDrawer";
import { useFlorin } from "@/lib/florinStore";
import { useSchools } from "@/lib/useSchools";
import { CoinIcon } from "@/components/ui/CoinIcon";
import { FlorinPurchaseModal } from "@/components/student/FlorinPurchaseModal";

/**
 * Site header — shared by all roles.
 *
 * `desktopAt` controls the responsive pivot between mobile/tablet and desktop
 * chrome. Student uses "xl" (1280px); Teacher/Admin use "md" (768px) so that
 * their desktop sidebar and layout are available from tablet width.
 */

const HEADER_CLASSES = {
  xl: "max-xl:sticky max-xl:top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-base bg-surface px-3 pb-2 pt-2 sm:-mx-6 sm:mb-6 sm:gap-3 sm:px-4 sm:pb-3 sm:pt-3 xl:mx-0 xl:px-0",
  md: "max-md:sticky max-md:top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-base bg-surface px-3 pb-2 pt-2 sm:-mx-6 sm:mb-6 sm:gap-3 sm:px-4 sm:pb-3 sm:pt-3 md:mx-0 md:px-0",
} as const;

const BRAND_CLASSES = { xl: "xl:hidden", md: "md:hidden" } as const;
const SCHOOL_CLASSES = { xl: "xl:block", md: "md:block" } as const;

export function SiteHeader({ href, showFlorin, showMenu, desktopAt = "xl" }: { href?: string; showFlorin?: boolean; showMenu?: boolean; desktopAt?: "md" | "xl" }) {
  const { balance } = useFlorin();
  const { schools } = useSchools();
  const [buyOpen, setBuyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const schoolName = schools[0]?.name;

  return (
    <header
      className={HEADER_CLASSES[desktopAt]}
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className={`flex min-w-0 flex-1 items-center gap-2 ${BRAND_CLASSES[desktopAt]}`}>
        {showMenu && !menuOpen && (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-tile text-muted transition hover:border-sealion max-[767px]:h-11 max-[767px]:w-11"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <BrandMark href={href} />
        </div>
      </div>
      <p className={`hidden min-w-0 flex-1 truncate text-sm font-medium text-muted ${SCHOOL_CLASSES[desktopAt]}`}>
        {schoolName ? `${schoolName} \u00b7 Hierarchy Class` : "Hierarchy Class"}
      </p>

      <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
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
      {menuOpen && <MobileDrawer onClose={closeMenu} />}
    </header>
  );
}
