"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDENT_NAV_ITEMS } from "@/components/navigation/navItems";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-base bg-surface xl:hidden">
      <div className="mx-auto flex max-w-sm items-center justify-around py-2">
        {STUDENT_NAV_ITEMS.map((item) => {
          const active = item.href ? pathname?.startsWith(item.href) : false;
          return (
            <Link key={item.href} href={item.href ?? "#"} className="flex flex-col items-center gap-1 px-2 py-1.5">
              {item.icon(!!active)}
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${active ? "text-navy" : "text-muted"}`}>
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
