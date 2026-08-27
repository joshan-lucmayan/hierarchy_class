"use client";

import { SideNav } from "@/components/navigation/SideNav";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { TeacherBottomNav } from "@/components/navigation/TeacherBottomNav";
import { AdminBottomNav } from "@/components/navigation/AdminBottomNav";
import { DeviceWarning } from "@/components/navigation/DeviceWarning";
import { PageBackdrop } from "@/components/dashboard/PageBackdrop";

type Role = "student" | "teacher" | "admin";

function BottomNavForRole({ role }: { role: Role }) {
  if (role === "teacher") return <TeacherBottomNav />;
  if (role === "admin") return <AdminBottomNav />;
  // Student navigation below xl is the header hamburger + MobileDrawer;
  // xl+ is the SideNav. No student bottom nav.
  return null;
}

// Bottom padding reserved for the fixed bottom navs. Students no longer have
// one, so they get normal comfortable spacing (+ safe area) instead of the
// 6rem clearance; desktop pivot is identical for every role.
function bottomPaddingFor(role: Role): { shell: string; main: string } {
  if (role === "student") {
    return {
      shell:
        "pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
      main: "pb-[calc(2rem+env(safe-area-inset-bottom))] sm:pb-[calc(2rem+env(safe-area-inset-bottom))]",
    };
  }
  return {
    shell: "pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-[calc(6rem+env(safe-area-inset-bottom))]",
    main: "pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-[calc(6rem+env(safe-area-inset-bottom))]",
  };
}

// Tailwind JIT requires complete class strings — no dynamic interpolation.
// Student desktop pivot at xl (1280px); Teacher/Admin at md (768px).
// Student phone (android < md) is full-bleed: no outer px/py so header/card/feed are edge-to-edge.
const SHELL_CLASSES = {
  xl: "relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6 sm:py-6 max-md:px-0 max-md:py-0 max-md:pt-0 xl:pl-[var(--sidebar-gap)] xl:pr-10 xl:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
  md: "relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6 sm:py-6 md:pl-[var(--sidebar-gap)] md:pr-10 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
} as const;

const MAIN_CLASSES = {
  xl: "flex-1 p-4 sm:p-6 max-md:p-0 max-md:pt-0 xl:p-8 xl:pb-8",
  md: "flex-1 p-4 sm:p-6 md:p-8 md:pb-8",
} as const;

export function AppShell({
  role,
  brandHref,
  children,
}: {
  role: Role;
  brandHref: string;
  children: React.ReactNode;
}) {
  const pad = bottomPaddingFor(role);
  const isPhoneBlocked = role === "teacher" || role === "admin";
  const desktopAt = isPhoneBlocked ? "md" : "xl";

  return (
    <div className="relative min-h-screen text-[var(--text)]" style={{ minHeight: "100dvh" }}>
      {role === "student" && <PageBackdrop />}
      <SideNav role={role} brandHref={brandHref} />

      {/* Phone block: teacher/admin below md see a device-warning screen. */}
      {isPhoneBlocked && (
        <div className="md:hidden">
          <DeviceWarning role={role} brandHref={brandHref} />
        </div>
      )}

      {/* Normal app content — hidden below md for teacher/admin when the
          device-warning is shown. Student is never affected. */}
      <div
        style={{ ["--sidebar-gap" as string]: "100px" }}
        className={`${SHELL_CLASSES[desktopAt]} ${pad.shell}${isPhoneBlocked ? " max-md:hidden" : ""}`}
      >
        <SiteHeader href={brandHref} showFlorin={role === "student"} showMenu={role === "student"} desktopAt={desktopAt} />
        <main
          className={`${MAIN_CLASSES[desktopAt]} ${pad.main} ${role === "student" ? "glass-cards" : ""}`}
        >
          {children}
        </main>
      </div>

      {/* Bottom navs — hidden at md+ for teacher/admin (desktop sidebar
          replaces them). Already hidden below md by DeviceWarning. */}
      <div className={isPhoneBlocked ? "max-md:hidden" : undefined}>
        <BottomNavForRole role={role} />
      </div>
    </div>
  );
}
