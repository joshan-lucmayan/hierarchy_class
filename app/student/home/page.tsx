"use client";

import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolFeed } from "@/lib/schoolFeedStore";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { FeedPost } from "@/components/feed/FeedPost";
import { StoriesRail } from "@/components/feed/StoriesRail";
import { QuickSearchBar } from "@/components/search/QuickSearchBar";
import SubjectStats from "@/components/dashboard/SubjectStats";
import HabitTracker from "@/components/dashboard/HabitTracker";
import WeeklyProgress from "@/components/dashboard/WeeklyProgress";
import WeakestSubjectCard from "@/components/dashboard/WeakestSubjectCard";

export default function StudentHomePage() {
  const { profile, loading, error } = useMyProfile();
  const { getStudentAverageByProfile, getStudentRankByProfile } = useClassroomHierarchy();
  const { posts, loading: feedLoading, error: feedError } = useSchoolFeed();

  const avg = profile ? getStudentAverageByProfile(profile.id) : null;
  const rank = profile ? getStudentRankByProfile(profile.id) : null;

  const academicExcellence = avg ?? 0;
  const displayRank = rank ?? "D";

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-md xl:mx-0">
        <QuickSearchBar />
      </div>

      <StoriesRail />

      <h1 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-faint">
        Latest School Feed
      </h1>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4">
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

        <aside className="space-y-4">
          {/* Profile / rank card */}
          <div className="rounded-[10px] border border-base bg-surface p-5">
            <div className="flex flex-col items-center text-center">
              {loading ? (
                <p className="text-sm text-muted">Loading...</p>
              ) : error ? (
                <p className="text-sm text-red-500">{error}</p>
              ) : (
                <>
                  <UserAvatar
                    name={profile?.full_name}
                    src={profile?.avatar_url}
                    size="xl"
                    className="border-2 border-surface"
                  />
                  <p className="mt-3 text-[17px] font-bold text-navy">
                    {profile?.full_name ?? "Student"}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {[profile?.educational_level, profile?.level_label].filter(Boolean).join(" · ")}
                  </p>

                  <div className="mt-5">
                    <RankBadge
                      rank={displayRank}
                      size="lg"
                      score={academicExcellence > 0 ? academicExcellence : null}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <WeakestSubjectCard />
          <SubjectStats />
          <HabitTracker />
          <WeeklyProgress />
        </aside>
      </div>
    </div>
  );
}
