"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "@/components/navigation/navItems";
import { MessagesBadge } from "@/components/navigation/MessagesBadge";
import { CrownMark } from "@/components/ui/CrownMark";

export function AdminBottomNav() {
  const pathname = usePathname();

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
      </div>
    </nav>
  );
}
