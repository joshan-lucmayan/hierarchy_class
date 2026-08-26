"use client";

import { SideNav } from "@/components/navigation/SideNav";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { TeacherBottomNav } from "@/components/navigation/TeacherBottomNav";
import { AdminBottomNav } from "@/components/navigation/AdminBottomNav";
import { PageBackdrop } from "@/components/dashboard/PageBackdrop";

type Role = "student" | "teacher" | "admin";

function BottomNavForRole({ role }: { role: Role }) {
  if (role === "teacher") return <TeacherBottomNav />;
  if (role === "admin") return <AdminBottomNav />;
  return <BottomNav />;
}

export function AppShell({
  role,
  brandHref,
  children,
}: {
  role: Role;
  brandHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen text-[var(--text)]" style={{ minHeight: "100dvh" }}>
      {role === "student" && <PageBackdrop />}
      <SideNav role={role} brandHref={brandHref} />
      <div
        style={{ ["--sidebar-gap" as string]: "100px" }}
        className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] xl:pl-[var(--sidebar-gap)] xl:pr-10 xl:pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <SiteHeader href={brandHref} showFlorin={role === "student"} />
        <main
          className={`flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] xl:p-8 xl:pb-8 ${role === "student" ? "glass-cards" : ""}`}
        >
          {children}
        </main>
      </div>
      <BottomNavForRole role={role} />
    </div>
  );
}
