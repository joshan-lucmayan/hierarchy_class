"use client";

import type { TierRank } from "@/types/student";

/**
 * Rank badge per the 07 right-column spec.
 *
 * The RANK LETTER is the hero - rendered large and bold - while the
 * academic-excellence score (when provided) sits beneath it at a deliberately
 * smaller size with a thin progress track and the uppercase caption. No
 * shield, star, chevron, or crest graphics - purely typographic + one bar.
 *
 * When `score` (0-100 academic excellence) is provided the score line, track
 * and caption render; list/row contexts (search, leaderboard, teacher roster,
 * admin panels) get a compact "{rank} Rank" pill only.
 */
interface RankBadgeProps {
  rank: TierRank;
  /** 0-100 academic excellence score - renders the score line, track, caption. */
  score?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const RANK_LETTER_SIZES = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[32px]",
} as const;

const DOT_SIZES = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
} as const;

const PILL_SIZES = {
  sm: "px-2.5 py-1 text-[11px] gap-1.5",
  md: "px-3 py-[6px] text-[13.5px] gap-2",
  lg: "px-3.5 py-[7px] text-[15.5px] gap-2",
} as const;

export function RankBadge({ rank, score, size = "md", className = "" }: RankBadgeProps) {
  const showScore = typeof score === "number" && score > 0;

  if (!showScore) {
    return (
      <span className={`inline-flex items-center rounded-md border border-line bg-tile ${PILL_SIZES[size]}`}>
        <span className={`shrink-0 rounded-full bg-gold ${DOT_SIZES[size]}`} />
        <span className="font-extrabold tracking-[0.3px] text-navy">{rank} Rank</span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Rank letter is the hero; score is secondary. */}
      <span className="flex items-center gap-2.5">
        <span className={`shrink-0 rounded-full bg-gold ${DOT_SIZES[size]}`} />
        <span className={`font-extrabold leading-none tracking-[0.02em] text-navy ${RANK_LETTER_SIZES[size]}`}>
          {rank}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3px] text-faint">Rank</span>
      </span>

      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="text-sm font-bold leading-none text-navy">{score}</span>
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
    </div>
  );
}
