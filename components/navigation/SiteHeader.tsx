"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/navigation/BrandMark";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { MobileDrawer } from "@/components/navigation/MobileDrawer";
import { useFlorin } from "@/lib/florinStore";
import { useSchools } from "@/lib/useSchools";
import { CoinIcon } from "@/components/ui/CoinIcon";
import { FlorinPurchaseModal } from "@/components/student/FlorinPurchaseModal";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { isNativeApp } from "@/lib/native";
import { useCollapsibleHeader } from "@/lib/useCollapsibleHeader";

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

/** Path → menu label mapping for the current page title. */
const MENU_LABELS: Record<string, string> = {
  "/student/home": "Home",
  "/student/messages": "Messages",
  "/student/learning-materials": "Materials",
  "/student/library": "Library",
  "/student/quiz": "Quiz",
  "/student/leaderboard": "Leaderboard",
  "/student/shop": "Shop",
  "/student/habits": "Habits",
  "/student/profile": "Profile",
  "/student/settings": "Settings",
  "/student/search": "Search",
  "/teacher/home": "Home",
  "/teacher/workspace": "Workspace",
  "/teacher/messages": "Messages",
  "/teacher/learning-materials": "Materials",
  "/teacher/classroom": "Classroom",
  "/teacher/quiz": "Quiz",
  "/teacher/students": "Students",
  "/teacher/library-management": "Library Management",
  "/teacher/settings": "Settings",
  "/admin/home": "Dashboard",
  "/admin/messages": "Messages",
  "/admin/users": "Users",
  "/admin/programs": "Education Levels",
  "/admin/students": "Students",
  "/admin/teachers": "Teachers",
  "/admin/reports": "Reports",
  "/admin/ranks": "Ranks",
  "/admin/settings": "Settings",
};

function currentMenuLabel(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  // Exact match first.
  if (MENU_LABELS[normalized]) return MENU_LABELS[normalized];
  // Prefix match for sub-routes like /student/profile/{id}.
  const prefix = Object.keys(MENU_LABELS).find((p) => normalized.startsWith(p + "/"));
  return prefix ? MENU_LABELS[prefix] : null;
}

/** True when the current route IS a top-level menu page (not a drill-down). */
function isMenuTopLevel(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return MENU_LABELS[normalized] !== undefined;
}

export function SiteHeader({ href, showFlorin, showMenu, desktopAt = "xl" }: { href?: string; showFlorin?: boolean; showMenu?: boolean; desktopAt?: "md" | "xl" }) {
  const { balance } = useFlorin();
  const { schools } = useSchools();
  const [buyOpen, setBuyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const pathname = usePathname();
  const router = useRouter();

  const schoolName = schools[0]?.name;
  const isStudent = showFlorin && showMenu;
  const normalizedPathname = (pathname ?? "").replace(/\/+$/, "") || "/";
  const isHome = normalizedPathname === "/student/home";

  const menuLabel = currentMenuLabel(pathname ?? "");
  const menuTopLevel = isMenuTopLevel(pathname ?? "");
  const native = isNativeApp();
  const compact = useCollapsibleHeader();

  // Student header: layout only — no logo, Search icon in header, visual tokens back to normal
  // Non-home student pages: back arrow only, no menu/name/search/florin/bell.
  // On Android: back returns to the Android menu selection (top-level menu
  // pages reopen the drawer; drill-down pages go back to the previous context),
  // and the header shows the current menu name instead of "Back to Home".
  // On Android, the header also collapses to a compact strip when scrolling down.
  // On the web/desktop/tablet the previous behavior is preserved.
  if (isStudent) {
    if (!isHome) {
      // Non-home student page header. On Android, when the user scrolls down
      // the header structurally collapses to ONLY the back-arrow bar (the
      // label and bottom border are removed from layout — nothing is left
      // occupying space). Scrolling up restores the full header.
      const collapsed = native && compact;
      return (
        <>
          <header
            className={`relative max-xl:sticky max-xl:top-0 z-30 mx-0 flex items-center border-b bg-surface px-2 transition-all duration-200 sm:px-4 xl:mx-0 xl:px-0 ${
              collapsed ? "gap-0 border-b-transparent py-0" : "gap-3 border-b-base py-2"
            }`}
            style={{
              paddingTop: collapsed
                ? "env(safe-area-inset-top)"
                : "max(0.5rem, env(safe-area-inset-top))",
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (!native) {
                  router.push("/student/home");
                } else if (menuTopLevel) {
                  // Return to the Android menu selection (the drawer).
                  setMenuOpen(true);
                } else {
                  router.back();
                }
              }}
              aria-label={native ? (menuTopLevel ? "Open menu" : "Back") : "Back to home"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-tile text-muted transition hover:border-sealion active:scale-[0.96]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span className={`truncate text-sm font-semibold text-navy transition-opacity duration-200 ${
              collapsed ? "hidden" : ""
            }`}>
              {native ? (menuLabel ?? "Back") : "Back to Home"}
            </span>
          </header>
          {buyOpen && <FlorinPurchaseModal onClose={() => setBuyOpen(false)} />}
          {menuOpen && <MobileDrawer onClose={closeMenu} />}
          {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
        </>
      );
    }
    return (
      <>
        <header
          className={`relative max-xl:sticky max-xl:top-0 z-30 mx-0 flex items-center border-b bg-surface px-2 transition-all duration-200 sm:gap-2 sm:px-4 xl:mx-0 xl:px-0 xl:pl-8 ${
            native && compact
              ? "gap-1 border-b-transparent py-0"
              : "gap-1 border-b-base py-2"
          }`}
          style={{
            paddingTop: native && compact
              ? "env(safe-area-inset-top)"
              : "max(0.5rem, env(safe-area-inset-top))",
          }}
        >
          <div className="flex shrink-0 items-center xl:hidden">
            {showMenu && !menuOpen && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-tile text-muted transition hover:border-sealion active:scale-[0.96]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              </button>
            )}
          </div>

          {/* App name — no logo, flex center so menu, name, search, florin, bell all stay visible.
              On Android it is removed from layout when scrolled down (compact keeps just the menu). */}
          <div className={`flex min-w-0 flex-1 items-center justify-center px-1 transition-all duration-200 sm:px-2 xl:hidden ${
            native && compact ? "hidden" : ""
          }`}>
            <span className="whitespace-nowrap text-center font-display text-xs font-bold uppercase tracking-[0.1em] text-navy sm:text-sm sm:tracking-[0.12em]">Hierarchy Class</span>
          </div>
          <p className="hidden min-w-0 flex-1 truncate text-sm font-medium text-muted xl:block">
            {schoolName ? `${schoolName} \u00b7 Hierarchy Class` : "Hierarchy Class"}
          </p>

          <div className={`flex shrink-0 items-center gap-1 transition-all duration-200 sm:gap-1.5 ${
            native && compact ? "hidden" : ""
          }`}>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-tile text-muted transition hover:border-sealion active:scale-[0.96] md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M16 16L21 21" />
              </svg>
            </button>
            {showFlorin && (
              <button
                type="button"
                onClick={() => setBuyOpen(true)}
                title="Buy Florin"
                className="flex h-11 items-center gap-1 rounded-full border border-line bg-tile px-2.5 text-xs font-semibold tabular-nums text-navy transition hover:border-sealion active:scale-[0.96] sm:gap-1.5 sm:px-4 sm:text-[13px]"
              >
                <CoinIcon size={14} />
                <span className="tabular-nums">{balance.toLocaleString()}</span>
                <span className="shrink-0 text-xs font-normal text-faint sm:text-[13px]">+</span>
              </button>
            )}
            <NotificationBell />
          </div>
        </header>

        {buyOpen && <FlorinPurchaseModal onClose={() => setBuyOpen(false)} />}
        {menuOpen && <MobileDrawer onClose={closeMenu} />}
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      </>
    );
  }

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