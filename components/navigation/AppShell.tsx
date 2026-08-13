"use client";

import { SideNav } from "@/components/navigation/SideNav";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { TeacherBottomNav } from "@/components/navigation/TeacherBottomNav";
import { AdminBottomNav } from "@/components/navigation/AdminBottomNav";

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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SideNav role={role} brandHref={brandHref} />
      <div
        style={{ ["--sidebar-gap" as string]: "100px" }}
        className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-6 py-6 pb-24 xl:pl-[var(--sidebar-gap)] xl:pr-10 xl:pb-6"
      >
        <SiteHeader href={brandHref} showFlorin={role === "student"} />
        <main className="flex-1 p-6 pb-24 xl:p-8 xl:pb-8">
          {children}
        </main>
      </div>
      <BottomNavForRole role={role} />
    </div>
  );
}
