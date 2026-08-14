"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { STUDENT_NAV_ITEMS, TEACHER_NAV_ITEMS, ADMIN_NAV_ITEMS } from "@/components/navigation/navItems";
import { useMyProfile } from "@/lib/useMyProfile";
import { createClient } from "@/lib/supabase/client";
import { MessagesBadge } from "@/components/navigation/MessagesBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CrownMark } from "@/components/ui/CrownMark";

type Role = "student" | "teacher" | "admin";

const ITEMS_BY_ROLE: Record<Role, typeof STUDENT_NAV_ITEMS> = {
  student: STUDENT_NAV_ITEMS,
  teacher: TEACHER_NAV_ITEMS,
  admin: ADMIN_NAV_ITEMS,
};

function useSidebarUser(role: Role) {
  const { profile } = useMyProfile();

  const name = profile?.full_name ?? "";
  const avatarUrl = profile?.avatar_url;
  const isLibrarian = profile?.is_librarian ?? false;

  let roleLabel = "";
  if (role === "teacher") {
    roleLabel = "Teacher";
  } else if (role === "admin") {
    roleLabel = "Administrator";
  } else {
    // Student identity: educational level, then grade/year level - no section.
    roleLabel = [profile?.educational_level, profile?.level_label].filter(Boolean).join(" · ");
  }

  return { name, avatarUrl, roleLabel, isLibrarian };
}

/**
 * Fixed-width icon rail (~64px) per the 07 spec: Kettle Black background,
 * muted icons that brighten on hover (tooltip via title), active item gets a
 * tile tint and a 2px accent left border. No expand-on-hover, no pin.
 */
export function SideNav({ role, brandHref }: { role: Role; brandHref: string }) {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const user = useSidebarUser(role);

  const items = ITEMS_BY_ROLE[role].filter(
    (item) => item.href !== "/teacher/library-management" || user.isLibrarian
  );

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-16 shrink-0 flex-col items-center border-r border-base bg-[var(--kettle)] py-5 xl:flex">
      <div className="mb-6 flex justify-center">
        <Link href={brandHref} title="Hierarchy Class" aria-label="Hierarchy Class" className="flex items-center justify-center">
          <CrownMark height={40} />
        </Link>
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-1">
        {items.map((item) => {
          const active = item.href ? pathname?.startsWith(item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href ?? "#"}
              title={item.label}
              aria-label={item.label}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                active ? "bg-tile" : "hover:bg-[var(--tile)]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 bg-sealion transition-opacity ${
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                }`}
              />
              <span
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center transition-colors ${
                  active ? "text-navy" : "text-faint group-hover:text-navy"
                }`}
              >
                {item.icon(!!active)}
                {item.href?.includes("/messages") && <MessagesBadge />}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 w-full border-t border-base pt-4">
        <div className="flex flex-col items-center gap-3.5">
          {/* Avatar is managed on the profile page - the rail just shows it. */}
          <Link
            href={role === "student" ? "/student/profile" : `/${role}/settings`}
            title={user.name || "Profile"}
            aria-label={user.name || "Profile"}
          >
            <UserAvatar name={user.name} src={user.avatarUrl} size="sm" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            title={isLoggingOut ? "Signing out..." : "Logout"}
            aria-label="Logout"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-[var(--tile)] hover:text-navy disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
