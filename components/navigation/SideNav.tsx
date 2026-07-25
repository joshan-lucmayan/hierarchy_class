"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { STUDENT_NAV_ITEMS, TEACHER_NAV_ITEMS, ADMIN_NAV_ITEMS } from "@/components/navigation/navItems";
import { CURRENT_STUDENT, TEACHER_PROFILE, ADMIN_PROFILE } from "@/data/mockStudents";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "teacher" | "admin";

const ITEMS_BY_ROLE: Record<Role, typeof STUDENT_NAV_ITEMS> = {
  student: STUDENT_NAV_ITEMS,
  teacher: TEACHER_NAV_ITEMS,
  admin: ADMIN_NAV_ITEMS,
};

function useSidebarUser(role: Role) {
  if (role === "teacher") {
    return { name: TEACHER_PROFILE.name, initials: TEACHER_PROFILE.initials, roleLabel: TEACHER_PROFILE.subject + " Teacher" };
  }
  if (role === "admin") {
    return { name: ADMIN_PROFILE.name, initials: ADMIN_PROFILE.initials, roleLabel: ADMIN_PROFILE.roleLabel };
  }
  return { name: CURRENT_STUDENT.name, initials: CURRENT_STUDENT.initials, roleLabel: `Grade ${CURRENT_STUDENT.gradeLevel} · ${CURRENT_STUDENT.section}` };
}

export function SideNav({
  role,
  brandHref,
  expanded,
  pinned,
  onHoverStart,
  onHoverEnd,
  onTogglePin,
}: {
  role: Role;
  brandHref: string;
  expanded: boolean;
  pinned: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onTogglePin: () => void;
}) {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const items = ITEMS_BY_ROLE[role];
  const user = useSidebarUser(role);

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={`fixed left-0 top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-base bg-surface py-5 shadow-card transition-[width] duration-300 ease-in-out xl:flex ${
        expanded ? "w-64" : "w-[76px]"
      }`}
    >
      <div className="mb-6 flex items-center justify-between px-[22px]">
        <Link href={brandHref} className="flex items-center gap-2.5 overflow-hidden">
          <svg width="24" height="18" viewBox="0 0 72 52" fill="none" className="shrink-0">
            <rect x="0" y="30" width="18" height="22" rx="2" fill="var(--text)" />
            <rect x="24" y="18" width="18" height="34" rx="2" fill="var(--text)" />
            <rect x="48" y="6" width="18" height="46" rx="2" fill="var(--text)" />
            <path d="M57 0l3 6 6 1-4.5 4.5 1 6L57 14.5 51 17.5l1-6L47.5 7l6-1z" fill="#c9962c" />
          </svg>
          <span
            className={`whitespace-nowrap text-sm font-bold uppercase tracking-[0.12em] text-navy transition-opacity duration-200 ${
              expanded ? "opacity-100 delay-100" : "pointer-events-none opacity-0"
            }`}
          >
            Hierarchy Class
          </span>
        </Link>

        <button
          type="button"
          onClick={onTogglePin}
          title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          className={`shrink-0 rounded-lg p-1.5 transition-all duration-200 ${
            expanded ? "opacity-100" : "pointer-events-none w-0 opacity-0"
          } ${pinned ? "bg-[var(--surface-strong)] text-gold" : "text-muted hover:bg-[var(--surface-strong)]"}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l1.5 5.5L19 9l-4.5 3.5L16 18l-4-3-4 3 1.5-5.5L5 9l5.5-1.5z" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const active = item.href ? pathname?.startsWith(item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href ?? "#"}
              title={expanded ? undefined : item.label}
              className={`group relative flex w-full items-center gap-3 rounded-2xl py-3 pl-3 pr-3 text-left text-sm font-semibold transition-colors duration-150 ${
                active ? "bg-[var(--surface-strong)] text-navy" : "text-muted hover:bg-[var(--surface-strong)]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gold transition-all duration-150 ${
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                }`}
              />
              <span className="flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-110">
                {item.icon(!!active)}
              </span>
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${
                  expanded ? "opacity-100 delay-75" : "pointer-events-none opacity-0"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 border-t border-base px-3 pt-4">
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl px-1 py-1">
          <img src="/avatars/default-avatar.webp" alt={user.name} className="h-9 w-9 shrink-0 rounded-full border-2 border-gold object-cover" />
          <div
            className={`min-w-0 flex-1 transition-opacity duration-200 ${
              expanded ? "opacity-100 delay-100" : "pointer-events-none w-0 opacity-0"
            }`}
          >
            <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
            <p className="truncate text-[11px] text-muted">{user.roleLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Logout"
          className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-[var(--surface-strong)] disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span
            className={`whitespace-nowrap transition-opacity duration-200 ${
              expanded ? "opacity-100 delay-75" : "pointer-events-none opacity-0"
            }`}
          >
            {isLoggingOut ? "Signing out..." : "Logout"}
          </span>
        </button>
      </div>
    </aside>
  );
}
