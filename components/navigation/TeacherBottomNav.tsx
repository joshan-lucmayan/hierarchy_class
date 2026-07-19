"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/teacher/home",
    label: "Home",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? "text-navy" : "text-muted"}>
        <path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/teacher/learning-materials",
    label: "Materials",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? "text-navy" : "text-muted"}>
        <path d="M4 19h16M4 5h16M4 12h16" />
      </svg>
    ),
  },
  {
    href: "/teacher/classroom",
    label: "Classroom",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? "text-navy" : "text-muted"}>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 21h8M12 18v3" />
      </svg>
    ),
  },
  {
    href: "/teacher/students",
    label: "Students",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? "text-navy" : "text-muted"}>
        <circle cx="9" cy="7" r="3" />
        <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M15.5 21c.2-2.5 1.8-4.3 4-5" />
      </svg>
    ),
  },
  {
    href: "/teacher/settings",
    label: "Settings",
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={active ? "text-navy" : "text-muted"}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 008.6 15a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0015 8.6a1.65 1.65 0 001.82.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9z" />
      </svg>
    ),
  },
];

export function TeacherBottomNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-base bg-surface xl:hidden">
        <div className="mx-auto flex max-w-sm items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-2 py-1.5"
              >
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
    </>
  );
}
