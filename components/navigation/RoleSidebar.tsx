"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface RoleSidebarProps {
  items: { href: string; label: string; icon: React.ReactNode }[];
}

export function RoleSidebar({ items }: RoleSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-base bg-surface px-5 py-6 xl:block">
      <div className="space-y-1">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                active ? "bg-[var(--surface-strong)] text-navy" : "text-muted hover:bg-[var(--surface-strong)]"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
