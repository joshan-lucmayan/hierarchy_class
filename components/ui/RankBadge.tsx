"use client";

import type { TierRank } from "@/types/student";

/**
 * Compact rank badge per the 07 right-column spec.
 *
 * The RANK is the hero: a flat pill - dark tile background, hairline border,
 * 6px radius, accent dot + "{rank} Rank" - rendered larger and bolder than
 * anything else. The academic-excellence score (when provided) sits beneath
 * it at a deliberately smaller size with a 4px progress track and the
 * uppercase caption. Purely typographic + one thin bar: no shield, star,
 * chevron, or crest graphics.
 *
 * When `score` (0-100 academic excellence) is provided the score line, track
 * and caption render; list/row contexts (search, leaderboard, teacher roster,
 * admin panels) get the pill only.
 */
interface RankBadgeProps {
  rank: TierRank;
  /** 0-100 academic excellence score - renders the score line, track, caption. */
  score?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const PILL_SIZES = {
  sm: "px-2.5 py-1 text-[11px] gap-1.5",
  md: "px-3 py-[6px] text-[13.5px] gap-2",
  lg: "px-3.5 py-[7px] text-[15.5px] gap-2",
} as const;

const DOT_SIZES = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
} as const;

const SCORE_SIZES = {
  sm: "text-[13px]",
  md: "text-[16px]",
  lg: "text-[18px]",
} as const;

export function RankBadge({ rank, score, size = "md", className = "" }: RankBadgeProps) {
  const showScore = typeof score === "number" && score > 0;

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <span
        className={`inline-flex items-center rounded-md border border-line bg-tile ${PILL_SIZES[size]}`}
      >
        <span className={`shrink-0 rounded-full bg-gold ${DOT_SIZES[size]}`} />
        <span className="font-extrabold tracking-[0.3px] text-navy">
          {rank} Rank
        </span>
      </span>

      {showScore && (
        <>
          <div className={`mt-2.5 flex items-baseline gap-1 ${SCORE_SIZES[size]}`}>
            <span className="font-bold leading-none text-navy">{score}</span>
            <span className="text-[11px] font-normal text-faint">/100</span>
          </div>
          <div className="mt-2 h-1 w-full max-w-[120px] overflow-hidden rounded-sm bg-line">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-muted">
            Academic excellence
          </p>
        </>
      )}
    </div>
  );
}
