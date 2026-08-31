"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { STUDENT_NAV_ITEMS } from "@/components/navigation/navItems";
import { MessagesBadge } from "@/components/navigation/MessagesBadge";
import { IconX } from "@/components/ui/icons";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { isNativeApp } from "@/lib/native";

/**
 * Student mobile/tablet navigation drawer (< xl, where the SideNav is hidden).
 * Slides in from the left over the page content and carries everything the
 * desktop rail provides: the profile & rank card, the stat blocks, the full
 * nav list (same STUDENT_NAV_ITEMS data as SideNav - no second list), and
 * logout. This is the primary student navigation below xl.
 *
 * Overlay conventions follow the shared Modal: portal to document.body,
 * safe-area env() padding, Escape/backdrop dismiss, focus moved into the
 * panel on open. The drawer spans the full viewport height (safe-area inset
 * respected via inner padding); if a fixed bottom bar is ever present again,
 * its measured height is cleared automatically.
 *
 * Platform rule: history manipulation (pushing a drawer entry on open and
 * REPLACING it on navigation so back never loops) exists ONLY for the native
 * Android app where the back arrow reopens this menu. On the web (desktop,
 * tablet, and mobile browsers) the drawer keeps the original behavior:
 * nav items are plain Next <Link>s with normal router.push history, and the
 * drawer auto-closes whenever the route changes.
 */

interface DrawerHistoryState {
  hcStudentDrawer?: boolean;
}

export function MobileDrawer({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [navClearance, setNavClearance] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const native = isNativeApp();

  useEffect(() => setMounted(true), []);

  // Clear any fixed bottom bar (none today for students - the drawer uses the
  // full viewport height); its measured height already includes the
  // safe-area-inset-bottom padding.
  useEffect(() => {
    if (!mounted) return;
    const nav = document.querySelector<HTMLElement>("nav.fixed");
    setNavClearance(nav ? nav.getBoundingClientRect().height : 0);
  }, [mounted]);

  // Programmatic closes consume the pushed history entry (so the next hardware
  // back doesn't get swallowed); popstate (back gesture) closes directly.
  const requestClose = useCallback(() => {
    const state = window.history.state as DrawerHistoryState | null;
    if (state?.hcStudentDrawer) {
      window.history.back(); // popstate fires -> onClose
    } else {
      onClose();
    }
  }, [onClose]);

  // Android only: selecting a nav item closes the drawer and navigates. The
  // drawer pushed a history entry on open; REPLACING it with the destination
  // keeps the stack clean — the next back goes to the page before the menu
  // (no stale drawer entry, no back loop when the Android back arrow reopens
  // the menu). On the web the nav items are <Link>s (original behavior), so
  // this path is never taken there.
  const go = useCallback(
    (href: string) => {
      if (native) {
        const state = window.history.state as DrawerHistoryState | null;
        if (state?.hcStudentDrawer) {
          router.replace(href);
        } else {
          router.push(href);
        }
      }
      onClose();
    },
    [native, router, onClose]
  );

  // Android only: history entry for the hardware back gesture, Escape, initial
  // focus, and auto-close if the viewport reaches the xl desktop layout
  // (drawer is never used there).
  useEffect(() => {
    if (!mounted) return;
    if (!native) return;
    const state = window.history.state as DrawerHistoryState | null;
    if (!state?.hcStudentDrawer) {
      window.history.pushState({ hcStudentDrawer: true } satisfies DrawerHistoryState, "");
    }
    const onPopState = () => onClose();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
      }
    };
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onDesktop = () => {
      if (desktop.matches) requestClose();
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onDesktop);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [mounted, native, onClose, requestClose]);

  // Web behavior (original): navigating anywhere (drawer link, browser back,
  // or any route change) closes the drawer.
  const initialPath = useRef(pathname);
  useEffect(() => {
    if (native) return;
    if (initialPath.current !== pathname) onClose();
  }, [native, pathname, onClose]);

  if (!mounted) return null;

  const navItemClass = (active: boolean) =>
    `flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition touch-manipulation ${
      active ? "bg-tile text-navy" : "text-muted hover:bg-[var(--tile)] hover:text-navy"
    }`;

  return createPortal(
    <>
      <div
        className="fixed left-0 right-0 top-0 z-40 bg-black/50"
        style={{ bottom: `${navClearance}px` }}
        onClick={requestClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Student menu"
        tabIndex={-1}
        className="animate-drawer-in fixed left-0 top-0 z-40 flex w-[85vw] max-w-sm flex-col border-r border-base bg-surface outline-none"
        style={{
          bottom: `${navClearance}px`,
          paddingLeft: "env(safe-area-inset-left)",
        }}
      >
        <div
          className="flex items-center justify-between gap-2 border-b border-base p-4"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-token">Menu</p>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted transition hover:text-navy"
          >
            <IconX size={14} />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain p-4"
          style={{
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <nav aria-label="Student sections" className="space-y-1">
            {STUDENT_NAV_ITEMS.map((item) => {
              const active = item.href ? pathname.startsWith(item.href) : false;
              // Android: button + managed history so back returns to the menu.
              // Web: original Next <Link> with normal push history.
              return native ? (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => item.href && go(item.href)}
                  aria-current={active ? "page" : undefined}
                  className={navItemClass(active)}
                >
                  <span className="relative shrink-0">
                    {item.icon(!!active)}
                    {item.href?.includes("/messages") && <MessagesBadge />}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href ?? "#"}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={navItemClass(active)}
                >
                  <span className="relative shrink-0">
                    {item.icon(!!active)}
                    {item.href?.includes("/messages") && <MessagesBadge />}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-base pt-4">
            <LogoutButton />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
