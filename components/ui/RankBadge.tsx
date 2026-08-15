"use client";

import type { Rank } from "@/lib/rankEngine";

/**
 * Rank badge per the 07 right-column spec, fed by the non-linear rank engine
 * (lib/rankEngine.ts + lib/rankStore.tsx).
 *
 * The RANK LETTER is the hero - rendered large and bold - while the rank bar
 * (or the open-ended EX score) sits beneath it at a deliberately smaller size
 * with a thin progress track and an uppercase caption. No shield, star,
 * chevron, or crest graphics - purely typographic + one bar.
 *
 * - Non-EX ranks: `bar` is the 0-100 progress toward the next rank; it renders
 *   as "N / 100" with a matching track fill.
 * - EX: `exScore` is the open-ended dominance score (uncapped); it replaces the
 *   bar entirely ("no /100", no track).
 * - List/row contexts (search, leaderboard, teacher roster, admin panels) pass
 *   no bar/exScore and get a compact "{rank} Rank" pill only.
 */
interface RankBadgeProps {
  rank: Rank;
  /** 0-100 bar progress toward the next rank. Meaningless for EX. */
  bar?: number | null;
  /** Open-ended EX score - replaces the bar when rank === "EX". */
  exScore?: number | null;
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

export function RankBadge({ rank, bar, exScore, size = "md", className = "" }: RankBadgeProps) {
  const isEx = rank === "EX";
  const hasBar = typeof bar === "number";
  const hasExScore = isEx && typeof exScore === "number";
  const showDetail = hasBar || hasExScore;

  if (!showDetail) {
    return (
      <span className={`inline-flex items-center rounded-md border border-line bg-tile ${PILL_SIZES[size]}`}>
        <span className={`shrink-0 rounded-full bg-gold ${DOT_SIZES[size]}`} />
        <span className="font-extrabold tracking-[0.3px] text-navy">{rank} Rank</span>
      </span>
    );
  }

  const displayValue = isEx ? Math.round(exScore ?? 0) : Math.round(bar ?? 0);
  const trackWidth = isEx ? 100 : Math.min(Math.max(bar ?? 0, 0), 100);

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Rank letter is the hero; the score is secondary. */}
      <span className="flex items-center gap-2.5">
        <span className={`shrink-0 rounded-full bg-gold ${DOT_SIZES[size]}`} />
        <span className={`font-extrabold leading-none tracking-[0.02em] text-navy ${RANK_LETTER_SIZES[size]}`}>
          {rank}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3px] text-faint">Rank</span>
      </span>

      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="text-sm font-bold leading-none text-navy">{displayValue}</span>
        {!isEx && <span className="text-[11px] font-normal text-faint">/100</span>}
      </div>
      {/* EX has no 0-100 bar - the score is open-ended, so the track shows full. */}
      <div className="mt-2 h-1 w-full max-w-[120px] overflow-hidden rounded-sm bg-line">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: `${trackWidth}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-muted">
        {isEx ? "Excellence" : "Academic excellence"}
      </p>
    </div>
  );
}
