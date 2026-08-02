"use client";

import { useEffect, useState } from "react";
import { SideNav } from "@/components/navigation/SideNav";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { TeacherBottomNav } from "@/components/navigation/TeacherBottomNav";
import { AdminBottomNav } from "@/components/navigation/AdminBottomNav";

type Role = "student" | "teacher" | "admin";

const PIN_STORAGE_KEY = "hc_sidebar_pinned";

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
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const expanded = pinned || hovering;

  useEffect(() => {
    const stored = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (stored === "1") setPinned(true);
  }, []);

  function togglePin() {
    setPinned((prev) => {
      const next = !prev;
      window.localStorage.setItem(PIN_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SideNav
        role={role}
        brandHref={brandHref}
        expanded={expanded}
        pinned={pinned}
        onHoverStart={() => setHovering(true)}
        onHoverEnd={() => setHovering(false)}
        onTogglePin={togglePin}
      />
      <div
        style={{ ["--sidebar-gap" as string]: expanded ? "280px" : "100px" }}
        className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-6 py-6 pb-24 transition-[padding-left] duration-300 ease-in-out xl:pl-[var(--sidebar-gap)] xl:pr-10 xl:pb-6"
      >
        <SiteHeader href={brandHref} showFlorin={role === "student"} />
        <main className="flex-1 rounded-[28px] border border-base bg-surface p-6 pb-24 xl:p-8 xl:pb-8">
          {children}
        </main>
      </div>
      <BottomNavForRole role={role} />
    </div>
  );
}
