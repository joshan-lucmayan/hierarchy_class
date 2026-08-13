"use client";

import { useMemo } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";

/**
 * Per-subject stats for the current student. Enrolled courses come from the
 * classroom store's course_enrollments data; averages come from the shared
 * getCourseAveragesByProfile helper (approved grades only) - no second fetch,
 * the store is already realtime-subscribed to grade_entries. The lowest-scoring
 * row is flagged with a "lowest" label and its bar uses the muted low-fill tone.
 */
export default function SubjectStats() {
  const { profile } = useMyProfile();
  const { loading, courses, getStudentRecordsByProfile, getCourseAveragesByProfile } =
    useClassroomHierarchy();

  const rows = useMemo(() => {
    if (!profile) return [];
    const enrolledCourseIds = new Set(
      getStudentRecordsByProfile(profile.id).map((s) => s.courseId)
    );
    const byCourse = new Map(getCourseAveragesByProfile(profile.id).map((a) => [a.courseId, a.avg]));
    return courses
      .filter((c) => enrolledCourseIds.has(c.id))
      .map((c) => ({ courseId: c.id, name: c.name, avg: byCourse.get(c.id) ?? null }));
  }, [profile, courses, getStudentRecordsByProfile, getCourseAveragesByProfile]);

  const lowestCourseId = useMemo(() => {
    const withAvg = rows.filter((r) => r.avg !== null);
    if (withAvg.length === 0) return null;
    return withAvg.reduce((a, b) => (a.avg! < b.avg! ? a : b)).courseId;
  }, [rows]);

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
        Subject Stats
      </h2>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">You are not enrolled in any courses yet.</p>
      ) : (
        <div>
          {rows.map((r, i) => {
            const isLowest = r.avg !== null && r.courseId === lowestCourseId;
            const fmt =
              r.avg === null
                ? "--"
                : r.avg % 1 === 0
                ? r.avg.toFixed(0)
                : r.avg.toFixed(1);
            return (
              <div
                key={r.courseId}
                className={i === 0 ? "pt-0" : "border-t border-line-soft pt-2.5"}
              >
                <div className="flex items-baseline justify-between gap-2 pb-1">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-navy">{r.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-faint">
                      {r.avg === null ? "No grades yet" : "Average score"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[15px] font-bold tabular-nums text-gold">
                    {fmt}
                    {isLowest ? (
                      <span className="ml-1 text-[10px] font-semibold normal-case tracking-normal text-warn">
                        · lowest
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="h-[5px] w-full overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${isLowest ? "bg-lowfill" : "bg-sealion"}`}
                    style={{ width: `${Math.min(r.avg ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CornerFrame>
  );
}
