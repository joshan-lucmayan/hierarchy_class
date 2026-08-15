"use client";

import { useMyProfile } from "@/lib/useMyProfile";
import { useSchoolFeed } from "@/lib/schoolFeedStore";
import { useRankStore } from "@/lib/rankStore";
import { useShop } from "@/lib/shopStore";
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
  const { rankOf } = useRankStore();
  const { equippedProfileCard } = useShop();
  const { posts, loading: feedLoading, error: feedError } = useSchoolFeed();

  const myRank = profile ? rankOf(profile.id) : null;
  const displayRank = myRank?.current_rank ?? "D";
  const rankBar = myRank && myRank.current_rank !== "EX" ? myRank.current_bar : null;
  const rankExScore = myRank?.current_rank === "EX" ? myRank.ex_score : null;

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-md xl:mx-0">
        <QuickSearchBar />
      </div>

      <StoriesRail />

      <h1 className="section-label mb-3">Latest School Feed</h1>

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
          <div className="relative overflow-hidden rounded-[10px] border border-base bg-surface p-5">
            {equippedProfileCard?.image_url && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${equippedProfileCard.image_url})` }}
                />
                <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface)_var(--art-tint),transparent)]" />
              </>
            )}
            <div className="relative flex flex-col items-center text-center">
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
                    profileId={profile?.id}
                  />
                  <p className="font-display mt-3 text-[19px] font-bold text-navy">
                    {profile?.full_name ?? "Student"}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {[profile?.educational_level, profile?.level_label].filter(Boolean).join(" · ")}
                  </p>

                  <div className="mt-5">
                    <RankBadge
                      rank={displayRank}
                      size="lg"
                      bar={rankBar}
                      exScore={rankExScore}
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
