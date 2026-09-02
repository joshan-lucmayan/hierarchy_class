"use client";

import type { Rank } from "@/lib/rankEngine";
import { RankTriangle } from "@/components/ui/RankTriangle";

/**
 * Rank badge per the v1.7.66 rank visual spec, fed by the non-linear rank
 * engine (lib/rankEngine.ts + lib/rankStore.tsx).
 *
 * The rank is represented by the shared INVERTED-TRIANGLE emblem
 * (RankTriangle) - the same shape across students, teachers, and admins.
 * The rank identity lives in the triangle; the rank letter is neutral
 * typography beside it (never inside the triangle, never rank-colored).
 * EX carries the accent "glory" glow.
 *
 * - Non-EX ranks: `bar` is the 0-100 progress toward the next rank; it renders
 *   as "N / 100" with a matching track fill.
 * - EX: `exScore` is the open-ended dominance score (uncapped); it replaces
 *   the bar entirely ("no /100", no track).
 * - List/row contexts (search, leaderboard, teacher roster, admin panels) pass
 *   no bar/exScore and get a compact "{rank} Rank" pill with a small triangle.
 */
interface RankBadgeProps {
  rank: Rank;
  /** 0-100 bar progress toward the next rank. Meaningless for EX. */
  bar?: number | null;
  /** Open-ended EX score - replaces the bar when rank === "EX". */
  exScore?: number | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const TRIANGLE_SIZES = {
  xs: "sm" as const,
  sm: "sm" as const,
  md: "md" as const,
  lg: "lg" as const,
};

/** Compact triangle emblem sizes for the detail rank row ([emblem] D RANK). */
const EMBLEM_SIZES = {
  xs: 12,
  sm: 12,
  md: 16,
  lg: 20,
} as const;

const RANK_LETTER_SIZES = {
  xs: "text-lg",
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[32px]",
} as const;

const PILL_SIZES = {
  xs: "px-2 py-[3px] text-[10.5px] gap-1",
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
        <RankTriangle rank={rank} size={TRIANGLE_SIZES[size]} showLabel={false} />
        <span className="font-extrabold tracking-[0.3px] text-navy">
          {rank}
          {size === "xs" ? "" : " Rank"}
        </span>
      </span>
    );
  }

  const displayValue = isEx ? Math.round(exScore ?? 0) : Math.round(bar ?? 0);
  const trackWidth = isEx ? 100 : Math.min(Math.max(bar ?? 0, 0), 100);

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Rank row: the triangle emblem carries the identity; the letter is
          neutral typography beside it (never inside the triangle). */}
      <span className="flex items-center gap-2.5">
        <RankTriangle rank={rank} size={EMBLEM_SIZES[size]} showLabel={false} />
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
          className="h-full rounded-full bg-accent"
          style={{ width: `${trackWidth}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-muted">
        {isEx ? "Excellence" : "Academic excellence"}
      </p>
    </div>
  );
}
