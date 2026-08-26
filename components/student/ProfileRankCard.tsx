"use client";

import { useMyProfile } from "@/lib/useMyProfile";
import { useRankStore } from "@/lib/rankStore";
import { useShop } from "@/lib/shopStore";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";

/**
 * The student profile / rank card from the home page's right column. Rendered
 * unchanged in two places: the desktop home aside (xl+) and the mobile/tablet
 * navigation drawer - keeping it in one component guarantees both stay
 * pixel-identical. Data hooks are the same stores the home page used.
 */
export function ProfileRankCard() {
  const { profile, loading, error } = useMyProfile();
  const { rankOf } = useRankStore();
  const { equippedProfileCard } = useShop();

  const myRank = profile ? rankOf(profile.id) : null;
  const displayRank = myRank?.current_rank ?? "D";
  const rankBar = myRank && myRank.current_rank !== "EX" ? myRank.current_bar : null;
  const rankExScore = myRank?.current_rank === "EX" ? myRank.ex_score : null;

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
      <div className="relative flex flex-col items-center text-center">
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : error ? (
          <p className="text-sm text-warn">{error}</p>
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

            <div className="mt-3">
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
  );
}
