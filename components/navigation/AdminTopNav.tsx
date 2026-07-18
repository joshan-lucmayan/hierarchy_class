"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/admin/home", label: "Home" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden xl:block mb-6 rounded-2xl border border-base bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center rounded-full px-4 py-2 transition-colors ${
                  active ? "bg-[var(--surface-strong)] text-navy" : "hover:bg-[var(--surface-strong)] hover:text-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
