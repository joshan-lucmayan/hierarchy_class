"use client";

import { useMemo } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolFeed } from "@/lib/schoolFeedStore";
import { useMyEnrollment } from "@/lib/useEnrollment";
import { RankBadge } from "@/components/ui/RankBadge";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { FeedPost } from "@/components/feed/FeedPost";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { EnrollmentBadge } from "@/components/ui/EnrollmentBadge";
import { QuickSearchBar } from "@/components/search/QuickSearchBar";

export default function StudentHomePage() {
  const { profile, loading, error } = useMyProfile();
  const {
    getStudentAverageByProfile,
    getStudentRankByProfile,
    getEntriesByProfile,
    programs,
    sections,
    courses,
    students: enrollments,
  } = useClassroomHierarchy();
  const { posts, loading: feedLoading, error: feedError } = useSchoolFeed();
  const { effective: enrollment, loading: enrollmentLoading, row: enrollmentRow } = useMyEnrollment();

  const avg = profile ? getStudentAverageByProfile(profile.id) : null;
  const rank = profile ? getStudentRankByProfile(profile.id) : null;
  const entries = profile
    ? getEntriesByProfile(profile.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const academicExcellence = avg ?? 0;
  const displayRank = rank ?? "D";

  const courseScores: Record<string, number[]> = {};
  entries.forEach((e) => {
    if (!courseScores[e.courseId]) courseScores[e.courseId] = [];
    courseScores[e.courseId].push(e.score);
  });
  const courseAvgs = Object.entries(courseScores).map(([courseId, scores]) => ({
    courseId,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
  const weakest = courseAvgs.sort((a, b) => a.avg - b.avg)[0];

  // Academic information: Program -> Section -> Courses from enrollments.
  const academicInfo = useMemo(() => {
    if (!profile) return null;
    const enrolledCourseIds = enrollments.filter((e) => e.profileId === profile.id).map((e) => e.courseId);
    const myCourses = courses.filter((c) => enrolledCourseIds.includes(c.id));
    const mySectionIds = Array.from(new Set(myCourses.map((c) => c.sectionId)));
    const mySections = sections.filter((s) => mySectionIds.includes(s.id));
    const myProgramIds = Array.from(new Set(mySections.map((s) => s.programId)));
    const myPrograms = programs.filter((p) => myProgramIds.includes(p.id));
    return {
      programs: myPrograms,
      sections: mySections,
      courses: myCourses,
    };
  }, [profile, enrollments, courses, sections, programs]);

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? "Course";

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-md xl:mx-0">
        <QuickSearchBar />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
        <section className="space-y-4">
          <StoriesRail />
          <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Latest School Feed</h1>
          {feedLoading ? (
            <p className="text-sm text-muted">Loading announcements...</p>
          ) : feedError ? (
            <p className="text-sm text-red-500">{feedError}</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted">No announcements yet.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <FeedPost key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="pb-2">
            <div className="flex flex-col items-center text-center">
              {loading ? (
                <p className="text-sm text-muted">Loading...</p>
              ) : (
                <>
                  <p className="text-lg font-bold text-navy">
                    {profile?.full_name ?? "Student"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {profile?.level_label ?? ""}
                    {profile?.section ? ` · ${profile.section}` : ""}
                  </p>

                  <div className="mt-5">
                    <RankBadge rank={displayRank} size="lg" />
                  </div>

                  <div className="mt-3">
                    <svg width="140" height="60" viewBox="0 0 140 60" fill="none">
                      <path d="M14 10 L70 50 L126 10" stroke="var(--border)" strokeWidth="19" strokeLinecap="butt" strokeLinejoin="miter" />
                      <path d="M14 10 L70 50 L126 10" stroke="var(--surface-strong)" strokeWidth="15" strokeLinecap="butt" strokeLinejoin="miter" />
                      <path
                        d="M14 10 L70 50 L126 10"
                        stroke="#c9962c"
                        strokeWidth="15"
                        strokeLinecap="butt"
                        strokeLinejoin="miter"
                        strokeDasharray={138}
                        strokeDashoffset={138 * (1 - academicExcellence / 100)}
                      />
                    </svg>
                  </div>
                  <div className="mt-1 flex flex-col items-center">
                    <p className="text-lg font-bold text-navy">
                      {academicExcellence > 0 ? academicExcellence : "--"}
                      <span className="text-xs font-semibold text-muted">/100</span>
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Academic Excellence</p>
                  </div>

                  {!enrollmentLoading && (
                    <div className="mt-5 w-full rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-left">
                      <EnrollmentBadge status={enrollment} expiresAt={enrollmentRow?.expires_at} size="sm" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {academicInfo && (academicInfo.programs.length > 0 || academicInfo.courses.length > 0) && (
            <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">My Academic Information</h2>
              <div className="mt-3 space-y-3">
                {academicInfo.programs.map((p) => (
                  <div key={p.id}>
                    <p className="text-sm font-semibold text-navy">{p.name}</p>
                    {academicInfo.sections
                      .filter((s) => s.programId === p.id)
                      .map((s) => (
                        <div key={s.id} className="mt-1">
                          <p className="text-xs text-muted">Section / Year: {s.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {academicInfo.courses
                              .filter((c) => c.sectionId === s.id)
                              .map((c) => (
                                <span key={c.id} className="rounded-full bg-[var(--surface-strong)] px-2.5 py-1 text-[11px] font-medium text-navy">
                                  {c.name}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </CornerFrame>
          )}

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Recent grades</h2>
            {entries.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No grades recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {entries.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-base px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-navy">{e.label}</p>
                      <p className="text-[10px] text-muted">{e.type} · {courseName(e.courseId)} · {e.date}</p>
                    </div>
                    <p className={`text-sm font-bold ${e.score >= 90 ? "text-gold" : e.score >= 75 ? "text-blue-500" : "text-red-500"}`}>
                      {e.score}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CornerFrame>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Weakest Subject</h2>
            {weakest ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-navy">{courseName(weakest.courseId)}</p>
                <p className="mt-1 text-xs text-muted">Average: {weakest.avg.toFixed(1)}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No subject-level grades recorded yet.</p>
            )}
          </CornerFrame>
        </aside>
      </div>
    </div>
  );
}
