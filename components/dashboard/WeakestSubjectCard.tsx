"use client";

import { useMemo } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";

const SPARK_BARS = 5;

/**
 * Weakest Subject card per the 07 right-column spec. Entirely derived from the
 * shared per-course average helper (so it can never disagree with Subject
 * Stats) plus the real approved grade history for that course: icon tile,
 * "tracking" pill, average line, a small sparkline of recent gradings, and a
 * trend note computed from those same entries.
 */
export default function WeakestSubjectCard() {
  const { profile } = useMyProfile();
  const { courses, getCourseAveragesByProfile, getEntriesByProfile } = useClassroomHierarchy();

  const weakest = useMemo(() => {
    if (!profile) return null;
    const avgs = getCourseAveragesByProfile(profile.id);
    if (avgs.length === 0) return null;
    const min = [...avgs].sort((a, b) => a.avg - b.avg)[0];
    const entries = getEntriesByProfile(profile.id)
      .filter((e) => e.courseId === min.courseId && e.approvalStatus === "approved")
      .sort((a, b) => a.date.localeCompare(b.date));
    return { courseId: min.courseId, avg: min.avg, totalTracked: avgs.length, entries };
  }, [profile, getCourseAveragesByProfile, getEntriesByProfile]);

  const spark = useMemo(() => (weakest ? weakest.entries.slice(-SPARK_BARS) : []), [weakest]);

  // Trend: comparing the last 2 gradings against the 2 before them.
  const note = useMemo(() => {
    if (!weakest) return null;
    if (weakest.entries.length < 3) return "Not enough gradings yet to spot a trend.";
    const scores = weakest.entries.map((e) => e.score);
    const recent = scores.slice(-2);
    const prior = scores.slice(-4, -2);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return avg(recent) < avg(prior)
      ? "Trending down over the last 3 gradings \u2014 flagged for review."
      : "Holding steady across recent gradings.";
  }, [weakest]);

  const courseName = courses.find((c) => c.id === weakest?.courseId)?.name ?? "Course";

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
          Weakest Subject
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded border border-[rgba(201,143,143,0.3)] bg-[rgba(201,143,143,0.08)] px-2 py-0.5 text-[10.5px] text-warn">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17l10-10" />
            <path d="M9 7h8v8" />
          </svg>
          tracking
        </span>
      </div>

      {!weakest ? (
        <p className="mt-4 text-sm text-muted">No subject-level grades recorded yet.</p>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-tile text-muted">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-navy">{courseName}</p>
              <p className="mt-0.5 text-xs text-muted">
                Average {weakest.avg.toFixed(1)} · lowest of {weakest.totalTracked} tracked subjects
              </p>
            </div>
          </div>

          {/* Sparkline: recent approved gradings, recent bars in the warning tone */}
          <div className="mt-3.5 flex h-[30px] items-end gap-1">
            {spark.map((e, i) => {
              const recent = i >= spark.length - 2;
              return (
                <span
                  key={e.id}
                  className={`flex-1 rounded-t-sm ${recent ? "bg-warnfill" : "bg-asphalt"}`}
                  style={{ height: `${Math.max((e.score / 100) * 100, 10)}%` }}
                />
              );
            })}
          </div>

          {note && <p className="mt-2 text-[11px] text-faint">{note}</p>}
        </div>
      )}
    </CornerFrame>
  );
}
