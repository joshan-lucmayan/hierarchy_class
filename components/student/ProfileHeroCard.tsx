"use client";

import { useMemo } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useRankStore } from "@/lib/rankStore";
import { useShop } from "@/lib/shopStore";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { RankTriangle } from "@/components/ui/RankTriangle";
import { UserAvatar } from "@/components/ui/UserAvatar";

/**
 * Phone hero profile/rank card for student Home — now back to normal sizing.
 * Reuses the same data as ProfileRankCard but keeps the phone hero position
 * and weakest-subject inset. Previously scaled to 36px radius / 96-112px avatar;
 * reverted to the original compact metrics (10px radius, 64px avatar) per request.
 */
export function ProfileHeroCard() {
  const { profile, loading, error } = useMyProfile();
  const { rankOf } = useRankStore();
  const { equippedProfileCard } = useShop();
  const { courses, getCourseAveragesByProfile, getEntriesByProfile } = useClassroomHierarchy();

  const myRank = profile ? rankOf(profile.id) : null;
  const displayRank = myRank?.current_rank ?? "D";
  const rankBar = myRank && myRank.current_rank !== "EX" ? myRank.current_bar : null;
  const rankExScore = myRank?.current_rank === "EX" ? myRank.ex_score : null;
  const isEx = displayRank === "EX";
  const hasBar = typeof rankBar === "number";
  const hasExScore = isEx && typeof rankExScore === "number";
  const displayValue = isEx ? Math.round(rankExScore ?? 0) : Math.round(rankBar ?? 0);
  const trackWidth = isEx ? 100 : Math.min(Math.max(rankBar ?? 0, 0), 100);

  const weakest = useMemo(() => {
    if (!profile) return null;
    const avgs = getCourseAveragesByProfile(profile.id);
    if (avgs.length === 0) return null;
    const min = [...avgs].sort((a, b) => a.avg - b.avg)[0];
    return { courseId: min.courseId, avg: min.avg, totalTracked: avgs.length };
  }, [profile, getCourseAveragesByProfile]);

  const courseName = courses.find((c) => c.id === weakest?.courseId)?.name ?? "Course";

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-base bg-surface p-3.5 sm:p-5">
      {equippedProfileCard?.image_url && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${equippedProfileCard.image_url})` }}
          />
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface)_var(--art-tint),transparent)]" />
        </>
      )}
      <div className="relative flex flex-col">
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : error ? (
          <p className="text-sm text-warn">{error}</p>
        ) : (
          <>
            {/* Top row: avatar left, name/meta/rank + 0/100 right — layout only, visual tokens back to normal */}
            <div className="flex gap-4">
              <UserAvatar
                name={profile?.full_name}
                src={profile?.avatar_url}
                size="xl"
                className="border-2 border-surface"
                profileId={profile?.id}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display break-words text-[19px] font-bold leading-none text-navy">
                      {profile?.full_name ?? "Student"}
                    </p>
                    <p className="mt-0.5 break-words text-[12.5px] font-normal text-muted">
                      {[profile?.educational_level, profile?.level_label].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5">
                        <RankTriangle rank={displayRank} size={14} showLabel={false} />
                        <span className="text-[22px] font-bold leading-none text-navy" style={{ fontFamily: "Georgia, Times, serif" }}>
                          {displayRank}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">Rank</span>
                      </span>
                      <span className="flex items-baseline gap-0.5 rounded-full border border-line bg-[var(--surface-strong)] px-2 py-0.5">
                        <span className="text-xs font-bold tabular-nums leading-none text-navy">{displayValue}</span>
                        {!isEx && <span className="text-[10px] font-normal text-faint">/100</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider + Academic Excellence label + thin gauge track */}
            <div className="mt-4 h-px w-full bg-line" />
            <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-faint">Academic excellence</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-sealion" style={{ width: `${trackWidth}%` }} />
            </div>

            {/* Weakest-subject inset — typography matches desktop WeakestSubjectCard (desktop is source of truth) */}
            {weakest ? (
              <div className="mt-4 w-full rounded-[10px] border border-base bg-[var(--surface-strong)] p-3.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-label">Weakest Subject</h2>
                  <span className="inline-flex items-center gap-1.5 rounded border border-[rgba(201,143,143,0.3)] bg-[rgba(201,143,143,0.08)] px-2 py-0.5 text-[10.5px] text-warn">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17l10-10" />
                      <path d="M9 7h8v8" />
                    </svg>
                    tracking
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-tile text-muted">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                      <path d="M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-navy">{courseName}</p>
                    <p className="mt-0.5 text-xs text-muted">Average {weakest.avg.toFixed(1)} · lowest of {weakest.totalTracked} tracked subjects</p>
                  </div>
                </div>
                <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-warn" style={{ width: `${Math.min(weakest.avg, 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-faint">Lowest of {weakest.totalTracked} tracked subjects</p>
              </div>
            ) : (
              <div className="mt-4 w-full rounded-[10px] border border-base bg-[var(--surface-strong)] p-3.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-label">Weakest Subject</h2>
                  <span className="inline-flex items-center gap-1.5 rounded border border-[rgba(201,143,143,0.3)] bg-[rgba(201,143,143,0.08)] px-2 py-0.5 text-[10.5px] text-warn">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17l10-10" />
                      <path d="M9 7h8v8" />
                    </svg>
                    tracking
                  </span>
                </div>
                <p className="mt-4 text-sm text-muted">No subject-level grades recorded yet.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
