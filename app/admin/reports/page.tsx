"use client";

import { useMemo } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { RankBadge } from "@/components/ui/RankBadge";

export default function AdminReportsPage() {
  const { programs, sections, courses, gradeEntries, getStudentAverageByProfile, getStudentRankByProfile } =
    useClassroomHierarchy();
  const { profiles: students, loading: studentsLoading } = useSchoolProfiles({ role: "student" });
  const { profiles: teachers, loading: teachersLoading } = useSchoolProfiles({ role: "teacher" });

  const studentStats = useMemo(
    () =>
      students.map((s) => ({
        profile: s,
        avg: getStudentAverageByProfile(s.id),
        rank: getStudentRankByProfile(s.id) ?? "D",
      })),
    [students, getStudentAverageByProfile, getStudentRankByProfile]
  );

  const schoolAverage = useMemo(() => {
    const avgs = studentStats.map((s) => s.avg).filter((v): v is number => v !== null);
    if (avgs.length === 0) return null;
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
  }, [studentStats]);

  const gradedStudentCount = studentStats.filter((s) => s.avg !== null).length;

  const rankDistribution = useMemo(() => {
    const dist: Record<string, number> = { "S++": 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
    studentStats.forEach((s) => {
      dist[s.rank] += 1;
    });
    return dist;
  }, [studentStats]);

  const gradeTypeBreakdown = useMemo(() => {
    const byType: Record<string, number[]> = { Exam: [], Quiz: [], Activity: [], Assignment: [] };
    gradeEntries.forEach((e) => {
      byType[e.type]?.push(e.score);
    });
    return Object.entries(byType).map(([type, scores]) => ({
      type,
      avg: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      count: scores.length,
    }));
  }, [gradeEntries]);

  const programAverages = useMemo(() => {
    return programs.map((program) => {
      const programSectionIds = sections.filter((s) => s.programId === program.id).map((s) => s.id);
      const programCourseIds = courses.filter((c) => programSectionIds.includes(c.sectionId)).map((c) => c.id);
      const entries = gradeEntries.filter((e) => programCourseIds.includes(e.courseId));
      const avg = entries.length > 0
        ? Math.round((entries.reduce((a, e) => a + e.score, 0) / entries.length) * 10) / 10
        : null;
      return { program, avg, courseCount: programCourseIds.length };
    });
  }, [programs, sections, courses, gradeEntries]);

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

  const topPerformers = useMemo(
    () =>
      studentStats
        .filter((s) => s.avg !== null)
        .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
        .slice(0, 5),
    [studentStats]
  );

  const needsAttention = useMemo(
    () =>
      studentStats
        .filter((s) => s.avg !== null && s.avg < 75)
        .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
        .slice(0, 5),
    [studentStats]
  );

  const teacherActivity = useMemo(() => {
    return teachers
      .map((t) => {
        const submitted = gradeEntries.filter((e) => e.submittedBy === t.id);
        const lastDate = submitted.length > 0 ? submitted.reduce((a, b) => (a.date > b.date ? a : b)).date : null;
        return { teacher: t, count: submitted.length, lastDate };
      })
      .sort((a, b) => b.count - a.count);
  }, [teachers, gradeEntries]);

  const SUMMARY_STATS = [
    { label: "School academic excellence", value: schoolAverage !== null ? `${schoolAverage}` : "No data yet" },
    { label: "Students with recorded grades", value: `${gradedStudentCount} / ${students.length}` },
    { label: "Total grade entries logged", value: `${gradeEntries.length}` },
    { label: "Courses tracked", value: `${courses.length}` },
  ];

  const loading = studentsLoading || teachersLoading;

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Reports</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">School progress</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Live academic excellence, rank distribution, and teacher activity for your school, computed from every grade submitted.
        </p>
      </CornerFrame>

      {loading && <p className="text-sm text-muted">Loading report data...</p>}

      {!loading && (
        <>
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
                    <RankBadge rank={rank as any} size="sm" />
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
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Average by grade type</h2>
              <div className="mt-4 space-y-2">
                {gradeTypeBreakdown.map((g) => (
                  <div key={g.type} className="flex items-center justify-between rounded-2xl border border-base px-3 py-2">
                    <div>
                      <p className="text-sm text-navy">{g.type}</p>
                      <p className="text-xs text-muted">{g.count} submitted</p>
                    </div>
                    <p className="text-sm font-bold text-gold">{g.avg ?? "--"}</p>
                  </div>
                ))}
              </div>
            </CornerFrame>
          </div>

          {programs.length > 0 && (
            <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Average by program</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {programAverages.map(({ program, avg, courseCount }) => (
                  <div key={program.id} className="rounded-2xl border border-base p-4">
                    <p className="text-sm font-semibold text-navy">{program.name}</p>
                    <p className="mt-1 text-xs text-muted">{courseCount} course{courseCount === 1 ? "" : "s"}</p>
                    <p className="mt-2 text-xl font-bold text-gold">{avg ?? "--"}</p>
                  </div>
                ))}
              </div>
            </CornerFrame>
          )}

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

          <div className="grid gap-6 xl:grid-cols-2">
            <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Top performers</h2>
              <div className="mt-4 space-y-2">
                {topPerformers.length === 0 ? (
                  <p className="text-sm text-muted">No grades recorded yet.</p>
                ) : (
                  topPerformers.map((s, i) => (
                    <div key={s.profile.id} className="flex items-center gap-3 rounded-2xl border border-base px-3 py-2">
                      <p className="w-5 text-center text-xs font-bold text-muted">{i + 1}</p>
                      <img
                        src={s.profile.avatar_url || "/avatars/default-avatar.webp"}
                        alt={s.profile.full_name}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <p className="flex-1 truncate text-sm text-navy">{s.profile.full_name}</p>
                      <p className="text-sm font-bold text-gold">{s.avg}</p>
                    </div>
                  ))
                )}
              </div>
            </CornerFrame>

            <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Students needing attention</h2>
              <p className="mt-1 text-[11px] text-muted">Averages below 75</p>
              <div className="mt-3 space-y-2">
                {needsAttention.length === 0 ? (
                  <p className="text-sm text-muted">No students below 75 right now.</p>
                ) : (
                  needsAttention.map((s) => (
                    <div key={s.profile.id} className="flex items-center gap-3 rounded-2xl border border-red-300 bg-red-500/5 px-3 py-2">
                      <img
                        src={s.profile.avatar_url || "/avatars/default-avatar.webp"}
                        alt={s.profile.full_name}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <p className="flex-1 truncate text-sm text-navy">{s.profile.full_name}</p>
                      <p className="text-sm font-bold text-red-600">{s.avg}</p>
                    </div>
                  ))
                )}
              </div>
            </CornerFrame>
          </div>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Teacher submission activity</h2>
            <div className="mt-4 space-y-2">
              {teacherActivity.length === 0 ? (
                <p className="text-sm text-muted">No teachers signed up yet.</p>
              ) : (
                teacherActivity.map(({ teacher, count, lastDate }) => (
                  <div key={teacher.id} className="flex items-center justify-between rounded-2xl border border-base px-3 py-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={teacher.avatar_url || "/avatars/default-avatar.webp"}
                        alt={teacher.full_name}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                      <p className="text-sm text-navy">{teacher.full_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gold">{count} grade{count === 1 ? "" : "s"}</p>
                      {lastDate && <p className="text-[11px] text-muted">Last: {lastDate}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CornerFrame>
        </>
      )}
    </div>
  );
}
