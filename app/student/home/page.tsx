"use client";

import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { RankBadge } from "@/components/ui/RankBadge";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { FeedPost } from "@/components/feed/FeedPost";
import { FriendsStories } from "@/components/feed/FriendsStories";
import { QuickSearchBar } from "@/components/search/QuickSearchBar";
import { SCHOOL_POSTS } from "@/data/schoolFeed";

export default function StudentHomePage() {
  const { profile, loading, error } = useMyProfile();
  const { getStudentAverageByProfile, getStudentRankByProfile, getEntriesByProfile } = useClassroomHierarchy();

  const avg = profile ? getStudentAverageByProfile(profile.id) : null;
  const rank = profile ? getStudentRankByProfile(profile.id) : null;
  const entries = profile
    ? getEntriesByProfile(profile.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const academicExcellence = avg ?? 0;
  const displayRank = rank ?? "C";

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

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-md xl:mx-0">
        <QuickSearchBar />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
        <section className="space-y-4">
          <FriendsStories />
          <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Latest School Feed</h1>
          <div className="space-y-4">
            {SCHOOL_POSTS.map((post) => (
              <FeedPost key={post.id} post={post} />
            ))}
          </div>
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
                </>
              )}
            </div>
          </div>

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
                      <p className="text-[10px] text-muted">{e.type} · {e.date}</p>
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
                <p className="text-sm font-semibold text-navy">Course ID: {weakest.courseId}</p>
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
