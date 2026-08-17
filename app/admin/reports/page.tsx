"use client";

import { useMemo } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Stat } from "@/components/ui/Stat";
import { Bar } from "@/components/ui/Bar";
import { EmptyState } from "@/components/ui/EmptyState";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconTask, IconPost, IconUser, IconCheck } from "@/components/ui/icons";
import { useRankStore } from "@/lib/rankStore";
import type { Rank } from "@/lib/rankEngine";

export default function AdminReportsPage() {
  const { programs, sections, courses, gradeEntries, getStudentAverageByProfile } =
    useClassroomHierarchy();
  const { rankOf } = useRankStore();
  const { profiles: students, loading: studentsLoading, error: studentsError } = useSchoolProfiles({ role: "student" });
  const { profiles: teachers, loading: teachersLoading, error: teachersError } = useSchoolProfiles({ role: "teacher" });

  const studentStats = useMemo(
    () =>
      students.map((s) => ({
        profile: s,
        avg: getStudentAverageByProfile(s.id),
        // Only students with an actual rank row count; unranked stay null and
        // are skipped by the distribution so they aren't mislabeled "D".
        rank: rankOf(s.id)?.current_rank ?? null,
      })),
    [students, getStudentAverageByProfile, rankOf]
  );

  const schoolAverage = useMemo(() => {
    const avgs = studentStats.map((s) => s.avg).filter((v): v is number => v !== null);
    if (avgs.length === 0) return null;
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
  }, [studentStats]);

  const gradedStudentCount = studentStats.filter((s) => s.avg !== null).length;

  const rankDistribution = useMemo(() => {
    const dist: Record<Rank, number> = { EX: 0, "S++": 0, "S+": 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
    studentStats.forEach((s) => {
      if (s.rank) dist[s.rank] += 1;
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

  const loading = studentsLoading || teachersLoading;
  const error = studentsError || teachersError;

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">School reports</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Live academic excellence · rank distribution · teacher activity
          </h2>
        </div>
        <Stat
          label="School excellence"
          value={loading ? "—" : schoolAverage !== null ? schoolAverage : "—"}
          tone="gold"
          hint="Weighted across all students"
        />
      </div>

      {loading ? (
        /* Skeleton: mirror the report geometry - stat tiles + section rows. */
        <CornerFrame className="p-5">
          <div className="h-3 w-40 animate-pulse rounded-full bg-tile" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-[8px] border border-line bg-tile" />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 rounded-[10px] border border-base p-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-tile" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 rounded-full bg-tile" />
                  <div className="h-2.5 w-24 rounded-full bg-tile" />
                </div>
                <div className="h-3 w-10 rounded-full bg-tile" />
              </div>
            ))}
          </div>
        </CornerFrame>
      ) : error ? (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
          Couldn&apos;t load report data. Please refresh and try again.
        </p>
      ) : (
        <>
          {/* ========================================================== */}
          {/* SNAPSHOT                                                  */}
          {/* ========================================================== */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="School academic excellence" value={schoolAverage !== null ? schoolAverage : "—"} tone="gold" />
            <Stat label="Students with recorded grades" value={`${gradedStudentCount} / ${students.length}`} />
            <Stat label="Total grade entries logged" value={gradeEntries.length} />
            <Stat label="Courses tracked" value={courses.length} />
          </section>

          {/* ========================================================== */}
          {/* RANK DISTRIBUTION + GRADE TYPE                            */}
          {/* ========================================================== */}
          <div className="grid gap-4 xl:grid-cols-2">
            <CornerFrame className="p-5">
              <h3 className="section-label">Rank distribution</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                Where students currently sit on the ladder - unranked students are not counted.
              </p>
              <div className="mt-4 space-y-2.5">
                {Object.entries(rankDistribution).map(([rank, count]) => (
                  <div key={rank} className="flex items-center gap-3">
                    <RankBadge rank={rank as Rank} size="sm" />
                    <Bar
                      value={students.length ? (count / students.length) * 100 : 0}
                      tone="gold"
                      size="md"
                      className="flex-1"
                    />
                    <p className="w-6 shrink-0 text-right font-mono-ui text-[11px] tabular-nums text-muted">{count}</p>
                  </div>
                ))}
              </div>
            </CornerFrame>

            <CornerFrame className="p-5">
              <h3 className="section-label">Average by grade type</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                Mean score per assessment type across every submitted grade.
              </p>
              <div className="mt-4 divide-y divide-[var(--border)]">
                {gradeTypeBreakdown.map((g) => (
                  <div key={g.type} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-navy">{g.type}</p>
                      <p className="mt-0.5 text-xs text-muted">{g.count} submitted</p>
                    </div>
                    <p className="shrink-0 font-mono-ui text-sm font-semibold tabular-nums text-gold-token">
                      {g.avg !== null ? g.avg : "--"}
                    </p>
                  </div>
                ))}
              </div>
            </CornerFrame>
          </div>

          {/* ========================================================== */}
          {/* AVERAGE BY PROGRAM                                        */}
          {/* ========================================================== */}
          {programs.length > 0 && (
            <CornerFrame className="p-5">
              <h3 className="section-label">Average by program</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                Mean score of every grade entered in each program&apos;s courses.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {programAverages.map(({ program, avg, courseCount }) => (
                  <div key={program.id} className="rounded-[10px] border border-base bg-surface p-4">
                    <p className="truncate text-sm font-semibold text-navy">{program.name}</p>
                    <p className="mt-1 text-xs text-muted">{courseCount} course{courseCount === 1 ? "" : "s"}</p>
                    <p className="mt-2 font-mono-ui text-xl font-bold tabular-nums text-gold-token">
                      {avg !== null ? avg : "--"}
                    </p>
                  </div>
                ))}
              </div>
            </CornerFrame>
          )}

          {/* ========================================================== */}
          {/* COURSE AVERAGES                                           */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Course averages</h3>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Mean score per course, highest first.
            </p>
            {courseAverages.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  icon={<IconTask size={16} />}
                  title="No courses yet"
                  desc="Course averages appear here once grades are submitted."
                />
              </div>
            ) : (
              <div className="mt-3 divide-y divide-[var(--border)]">
                {courseAverages.map(({ course, avg }) => (
                  <div key={course.id} className="flex items-center justify-between gap-4 py-2.5">
                    <p className="min-w-0 truncate text-sm text-navy">{course.name}</p>
                    <p className="shrink-0 font-mono-ui text-sm font-semibold tabular-nums text-gold-token">
                      {avg !== null ? avg : "--"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CornerFrame>

          {/* ========================================================== */}
          {/* TOP PERFORMERS + NEEDING ATTENTION                        */}
          {/* ========================================================== */}
          <div className="grid gap-4 xl:grid-cols-2">
            <CornerFrame className="p-5">
              <h3 className="section-label">Top performers</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                The five students with the highest weighted averages.
              </p>
              {topPerformers.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    icon={<IconPost size={16} />}
                    title="No grades recorded yet"
                    desc="Once grades are in, the top students appear here."
                  />
                </div>
              ) : (
                <div className="mt-3 divide-y divide-[var(--border)]">
                  {topPerformers.map((s, i) => (
                    <div key={s.profile.id} className="flex items-center gap-3 py-2.5">
                      <p className="w-5 shrink-0 text-center font-mono-ui text-[11px] tabular-nums text-muted">{i + 1}</p>
                      <UserAvatar name={s.profile.full_name} src={s.profile.avatar_url} size="sm" profileId={s.profile.id} />
                      <p className="min-w-0 flex-1 truncate text-sm text-navy">{s.profile.full_name}</p>
                      {s.rank && <RankBadge rank={s.rank} size="sm" />}
                      <p className="shrink-0 font-mono-ui text-sm font-semibold tabular-nums text-gold-token">{s.avg}</p>
                    </div>
                  ))}
                </div>
              )}
            </CornerFrame>

            <CornerFrame className="p-5">
              <h3 className="section-label">Students needing attention</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                Students with a weighted average below 75.
              </p>
              {needsAttention.length === 0 ? (
                <div className="py-4">
                  <EmptyState
                    icon={<IconCheck size={16} />}
                    title="All clear"
                    desc="No students are currently below 75."
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {needsAttention.map((s) => (
                    <div key={s.profile.id} className="flex items-center gap-3 rounded-[10px] border border-warn-soft bg-warn-soft px-3 py-2.5">
                      <UserAvatar name={s.profile.full_name} src={s.profile.avatar_url} size="sm" profileId={s.profile.id} />
                      <p className="min-w-0 flex-1 truncate text-sm text-navy">{s.profile.full_name}</p>
                      <p className="shrink-0 font-mono-ui text-sm font-semibold tabular-nums text-warn">{s.avg}</p>
                    </div>
                  ))}
                </div>
              )}
            </CornerFrame>
          </div>

          {/* ========================================================== */}
          {/* TEACHER SUBMISSION ACTIVITY                               */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Teacher submission activity</h3>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              How many grades each teacher has submitted so far.
            </p>
            {teacherActivity.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  icon={<IconUser size={16} />}
                  title="No teachers signed up yet"
                  desc="Submission activity appears here once teachers join."
                />
              </div>
            ) : (
              <div className="mt-3 divide-y divide-[var(--border)]">
                {teacherActivity.map(({ teacher, count, lastDate }) => (
                  <div key={teacher.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={teacher.full_name} src={teacher.avatar_url} size="sm" profileId={teacher.id} />
                      <p className="min-w-0 truncate text-sm text-navy">{teacher.full_name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono-ui text-sm font-semibold tabular-nums text-gold-token">
                        {count} grade{count === 1 ? "" : "s"}
                      </p>
                      {lastDate && <p className="mt-0.5 text-[11px] text-muted">Last: {lastDate}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CornerFrame>
        </>
      )}
    </div>
  );
}
