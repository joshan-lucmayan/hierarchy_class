"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "@/components/navigation/navItems";
import { MessagesBadge } from "@/components/navigation/MessagesBadge";
import { CrownMark } from "@/components/ui/CrownMark";
import { useLogoutFlow, LogoutConfirmModal } from "@/components/auth/LogoutButton";

export function AdminBottomNav() {
  const pathname = usePathname();
  const { confirmOpen, setConfirmOpen, isLoggingOut, confirmLogout } = useLogoutFlow();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-base bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-1 overflow-x-auto overscroll-contain px-2 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/admin/home"
          title="Hierarchy Class"
          aria-label="Hierarchy Class"
          className="flex shrink-0 items-center justify-center px-2 py-1"
        >
          <CrownMark height={24} />
        </Link>
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = item.href ? pathname?.startsWith(item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href ?? "#"}
              aria-current={active ? "page" : undefined}
              className="flex min-h-[44px] min-w-[56px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 touch-manipulation"
            >
              <span className="relative">
                {item.icon(!!active)}
                {item.href?.includes("/messages") && <MessagesBadge />}
              </span>
              <span
                className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide ${active ? "text-navy" : "text-muted"}`}
              >
                {item.label}
              </span>
              {active && <span className="h-0.5 w-4 rounded-full bg-gold" />}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isLoggingOut}
          aria-label="Log out"
          className="flex min-h-[44px] min-w-[56px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 touch-manipulation disabled:opacity-60"
        >
          <span className="relative text-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </span>
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted">
            Log out
          </span>
        </button>
      </div>

      <LogoutConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        isLoggingOut={isLoggingOut}
        onConfirm={confirmLogout}
      />
    </nav>
  );
}
