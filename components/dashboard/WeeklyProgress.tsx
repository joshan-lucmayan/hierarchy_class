"use client";

import { useMemo } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { getCurrentWeek } from "@/lib/weekUtils";
import { CornerFrame } from "@/components/ui/CornerFrame";

/** Chart area height in px - bars scale as a percentage of this. */
const CHART_HEIGHT = 110;

/**
 * Weekly Progress: average approved grade score per day (Mon-Sun, local
 * timezone), derived entirely from the grade_entries already loaded by the
 * classroom store - no new table, no second fetch. Days with no approved
 * entries render as a very short muted stub so all 7 columns stay aligned.
 */
export default function WeeklyProgress() {
  const { profile } = useMyProfile();
  const { loading, gradeEntries } = useClassroomHierarchy();
  const { days } = getCurrentWeek();

  const dayAverages = useMemo(() => {
    if (!profile) return new Map<string, number>();
    const byDay = new Map<string, number[]>();
    gradeEntries.forEach((e) => {
      // Approved grades only; e.date is the entry_date (YYYY-MM-DD) in the
      // user's local timezone, matching how the rest of the app renders dates.
      if (e.studentId === profile.id && e.approvalStatus === "approved") {
        const scores = byDay.get(e.date) ?? [];
        scores.push(e.score);
        byDay.set(e.date, scores);
      }
    });
    const averages = new Map<string, number>();
    byDay.forEach((scores, date) => {
      averages.set(date, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10);
    });
    return averages;
  }, [profile, gradeEntries]);

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <h2 className="section-label">
        Weekly Progress
      </h2>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : (
        <div className="mt-2 flex items-end gap-2">
          {days.map((d) => {
            const avg = dayAverages.get(d.date) ?? 0;
            const height = avg > 0 ? Math.max((avg / 100) * CHART_HEIGHT, 6) : 0;
            return (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center justify-end"
                style={{ height: `${CHART_HEIGHT}px` }}
              >
                {avg > 0 ? (
                  <div
                    className="w-[70%] rounded-t-[3px] bg-sealion transition-all duration-500"
                    style={{ height: `${height}px` }}
                  />
                ) : (
                  <div className="w-[70%] rounded-t-[3px] bg-line" style={{ height: "3px" }} />
                )}
                <p className="mt-1.5 text-[10px] font-medium text-faint">{d.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </CornerFrame>
  );
}
