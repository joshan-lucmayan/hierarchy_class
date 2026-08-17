"use client";

import { useEffect, useState } from "react";

/**
 * Day/time helpers shared by Teacher Home and Teacher Workspace so both
 * surfaces render "today" and time labels identically. Extracted from
 * app/teacher/home/page.tsx - pure functions plus the 30s ticking clock.
 */

export function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function todayDayName(now: Date) {
  return now.toLocaleDateString("en-US", { weekday: "long" });
}

export function formatDisplayDate(now: Date) {
  return now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function todayDateInput(now: Date) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function nowHHMM(now: Date) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatTimeLabel(hhmm: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

/** Re-renders every 30s so "today" lists automatically drop items once their end time passes. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * True once the viewport is at the md breakpoint (768px+). Used to apply
 * explicit grid placement on desktop while widgets stack full-width on
 * mobile. Placement is applied as INLINE styles (see the Home dashboard), so
 * it never depends on Tailwind generating utility classes.
 */
export function useIsMd(): boolean {
  const [isMd, setIsMd] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsMd(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMd;
}
