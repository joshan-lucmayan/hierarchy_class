"use client";

import { useMemo } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";

const RANK_STYLES: Record<string, string> = {
  "S++": "bg-navy text-gold",
  S: "bg-gold text-navy",
  A: "bg-blue-100 text-blue-700",
  B: "bg-green-100 text-green-700",
  C: "bg-gray-100 text-gray-600",
  D: "bg-red-100 text-red-600",
};

export default function AdminReportsPage() {
  const { students, courses, getStudentAverage, getStudentRank, gradeEntries } = useClassroomHierarchy();

  const schoolAverage = useMemo(() => {
    const avgs = students.map((s) => getStudentAverage(s.id)).filter((v): v is number => v !== null);
    if (avgs.length === 0) return null;
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
  }, [students, getStudentAverage]);

  const rankDistribution = useMemo(() => {
    const dist: Record<string, number> = { "S++": 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
    students.forEach((s) => {
      const rank = getStudentRank(s.id);
      if (rank) dist[rank] += 1;
    });
    return dist;
  }, [students, getStudentRank]);

  const courseAverages = useMemo(() => {
    return courses
      .map((course) => {
        const entries = gradeEntries.filter((e) => e.courseId === course.id);
        if (entries.length === 0) return { course, avg: null as number | null };
        const avg = Math.round((entries.reduce((a, e) => a + e.score, 0) / entries.length) * 10) / 10;
        return { course, avg };
      })
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [courses, gradeEntries]);

  const gradedStudentCount = students.filter((s) => getStudentAverage(s.id) !== null).length;

  const SUMMARY_STATS = [
    { label: "School academic excellence", value: schoolAverage !== null ? `${schoolAverage}` : "No data yet" },
    { label: "Students with recorded grades", value: `${gradedStudentCount} / ${students.length}` },
    { label: "Total grade entries logged", value: `${gradeEntries.length}` },
    { label: "Courses tracked", value: `${courses.length}` },
  ];

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Reports</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">School progress</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Live academic excellence and rank distribution for your school, computed from every grade submitted.
        </p>
      </CornerFrame>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_STATS.map((stat) => (
          <CornerFrame
            key={stat.label}
            className="rounded-3xl border border-base bg-surface p-6 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{stat.label}</p>
            <p className="mt-4 text-3xl font-bold text-navy">{stat.value}</p>
          </CornerFrame>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Rank distribution</h2>
          <div className="mt-4 space-y-2">
            {Object.entries(rankDistribution).map(([rank, count]) => (
              <div key={rank} className="flex items-center gap-3">
                <span className={`w-12 shrink-0 rounded-full px-2 py-1 text-center text-[11px] font-bold ${RANK_STYLES[rank]}`}>
                  {rank}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                  <div
                    className="h-full bg-gold"
                    style={{ width: students.length ? `${(count / students.length) * 100}%` : "0%" }}
                  />
                </div>
                <p className="w-6 shrink-0 text-right text-xs font-semibold text-navy">{count}</p>
              </div>
            ))}
          </div>
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Course averages</h2>
          <div className="mt-4 space-y-2">
            {courseAverages.length === 0 && <p className="text-sm text-muted">No courses yet.</p>}
            {courseAverages.map(({ course, avg }) => (
              <div key={course.id} className="flex items-center justify-between rounded-2xl border border-base px-3 py-2">
                <p className="text-sm text-navy">{course.name}</p>
                <p className="text-sm font-bold text-gold">{avg !== null ? avg : "--"}</p>
              </div>
            ))}
          </div>
        </CornerFrame>
      </div>
    </div>
  );
}
