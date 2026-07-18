"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/teacher/home", label: "Home" },
  { href: "/teacher/learning-materials", label: "Materials" },
  { href: "/teacher/classroom", label: "Classroom" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/settings", label: "Settings" },
];

export function TeacherTopNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 rounded-2xl border border-base bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center rounded-full px-4 py-2 transition-colors ${
                  active ? "bg-surface-strong text-navy" : "hover:bg-gray-50 hover:text-slate-700"
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
