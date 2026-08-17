"use client";

import Link from "next/link";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Bar } from "@/components/ui/Bar";
import { Chip } from "@/components/ui/Chip";
import type { ActiveSemester } from "@/lib/classroomHierarchyStore";

/** Pure progress math (exported for tests): 0..1 elapsed + days remaining. */
export function semesterProgress(
  sem: { start_date: string; end_date: string },
  now: Date = new Date()
): { pct: number; daysLeft: number; label: string } {
  const start = new Date(sem.start_date).getTime();
  const end = new Date(sem.end_date).getTime();
  const total = end - start;
  if (total <= 0) return { pct: 0, daysLeft: 0, label: "No time window" };
  const pct = Math.min(Math.max((now.getTime() - start) / total, 0), 1);
  const daysLeft = Math.max(Math.ceil((end - now.getTime()) / 86_400_000), 0);
  const label =
    daysLeft === 0
      ? "Ends today"
      : daysLeft === 1
        ? "1 day remaining"
        : `${daysLeft} days remaining`;
  return { pct, daysLeft, label };
}

/**
 * The season is the natural timeline of Hierarchy Class: admins declare it,
 * grades are graded against it, and season end reseeds the ladder. This card
 * renders where the school is inside that window, straight from the dates the
 * admin set - nothing hardcoded.
 */
export function SemesterProgress({ semester }: { semester: ActiveSemester | null }) {
  if (!semester) {
    return (
      <CornerFrame className="h-full p-5">
        <h2 className="section-label">Current Semester</h2>
        <p className="mt-3 text-[13px] leading-5 text-muted">
          No active semester yet. Teachers can&apos;t submit grades until one is
          declared.
        </p>
        <Link
          href="/admin/ranks"
          className="mt-3 inline-block rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover-bg-gold-token hover-text-on-accent"
        >
          Declare a semester
        </Link>
      </CornerFrame>
    );
  }

  const { pct, label } = semesterProgress(semester);
  const title = [semester.school_year, semester.semester_label].filter(Boolean).join(" · ");

  return (
    <CornerFrame className="h-full p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-label">Current Semester</h2>
        <Chip variant="gold">{Math.round(pct * 100)}%</Chip>
      </div>
      <p className="mt-2 truncate text-[15px] font-bold text-navy">{title || "Semester"}</p>
      <Bar value={pct * 100} tone="gold" size="md" className="mt-3 w-full" />
      <div className="mt-2 flex items-center justify-between text-[11.5px]">
        <span className="text-muted">{semester.start_date}</span>
        <span className="font-semibold text-navy">{label}</span>
        <span className="text-muted">{semester.end_date}</span>
      </div>
    </CornerFrame>
  );
}
