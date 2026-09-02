"use client";

import type { Rank } from "@/lib/rankEngine";

/**
 * The Hierarchy Class rank emblem - an INVERTED (upside-down) triangle.
 *
 * One shared component across every role and surface (student/teacher/admin
 * ranks, profiles, search results, leaderboards, season history, dashboards).
 * The shape is deliberately clean: no letters inside the triangle - the rank
 * letter/name renders BELOW it (or beside it, in row contexts) as neutral
 * typography. Rank identity lives in the triangle's fill/border, which mirror
 * the rank token palette in tailwind.config.ts (rank / rankBorder), so the
 * hierarchy and tier colors are unchanged.
 *
 * EX gets the "glory" treatment: a accent gradient fill, layered inner facets,
 * and a soft controlled glow (drop-shadows, never neon). When the glow is
 * reduced or disabled the triangle stays minimalist, exactly like the lower
 * tiers.
 */

const RANK_FILL: Record<Rank, string> = {
  D: "#4a1f24",
  C: "#f1efe8",
  B: "#eaf3de",
  A: "#e6f1fb",
  S: "#9ea7b3",
  "S+": "#9ea7b3",
  "S++": "#464c55",
  EX: "#9ea7b3",
};

const RANK_BORDER: Record<Rank, string> = {
  D: "#a05252",
  C: "#b4b2a9",
  B: "#97c459",
  A: "#85b7eb",
  S: "#9ea7b3",
  "S+": "#9ea7b3",
  "S++": "#9ea7b3",
  EX: "#c2c7cf",
};

// The accent gradient used for the EX tier (same values as the landing hero).
const EX_GRADIENT = { from: "#c2c7cf", to: "#9ea7b3" };

const SIZE_PRESETS = { sm: 18, md: 26, lg: 44 } as const;

interface RankTriangleProps {
  rank: Rank;
  /** Width in px (height derives from the equilateral ratio). */
  size?: keyof typeof SIZE_PRESETS | number;
  /** Legendary aura for EX (on by default for EX, off for lower tiers). */
  glow?: boolean;
  /** Renders the rank letter/name BELOW the triangle. */
  showLabel?: boolean;
  className?: string;
}

export function RankTriangle({
  rank,
  size = "md",
  glow,
  showLabel = true,
  className = "",
}: RankTriangleProps) {
  const px = typeof size === "number" ? size : SIZE_PRESETS[size];
  const isEx = rank === "EX";
  const withGlow = glow ?? isEx;
  const height = px * 0.866; // equilateral triangle height

  // viewBox is fixed (24 x 20.784) so the shape scales cleanly at any size.
  const vw = 24;
  const vh = Math.round(24 * 0.866 * 1000) / 1000;

  return (
    <span
      className={`inline-flex flex-col items-center ${className}`}
      role="img"
      aria-label={`${rank} rank`}
    >
      <svg
        width={px}
        height={height}
        viewBox={`0 0 ${vw} ${vh}`}
        fill="none"
        aria-hidden
        style={
          withGlow
            ? {
                filter:
                  isEx
                    ? "drop-shadow(0 0 5px rgba(198,201,207,0.85)) drop-shadow(0 0 14px rgba(158,167,179,0.45))"
                    : "drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
              }
            : undefined
        }
      >
        <defs>
          {isEx && (
            <linearGradient id={`rank-ex-${px}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={EX_GRADIENT.from} />
              <stop offset="1" stopColor={EX_GRADIENT.to} />
            </linearGradient>
          )}
        </defs>

        {/* Main inverted triangle */}
        <path
          d={`M1 1.8 L${vw - 1} 1.8 L${vw / 2} ${vh - 1.2} Z`}
          fill={isEx ? `url(#rank-ex-${px})` : RANK_FILL[rank]}
          stroke={isEx ? EX_GRADIENT.to : RANK_BORDER[rank]}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />

        {/* Layered depth: a soft inner facet keeps the emblem dimensional
            without any text inside. */}
        <path
          d={`M4 4.6 L${vw - 4} 4.6 L${vw / 2} ${vh - 3.4} Z`}
          fill={isEx ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.35)"}
          stroke="none"
        />
        {/* Top edge highlight */}
        <path
          d={`M3 3.1 L${vw - 3} 3.1`}
          stroke={isEx ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.6)"}
          strokeWidth="1"
          strokeLinecap="round"
        />
        {/* Center core for EX - the "glory" point */}
        {isEx && (
          <circle cx={vw / 2} cy={vh * 0.42} r="1.6" fill="rgba(255,255,255,0.85)" />
        )}
      </svg>

      {showLabel && (
        <span className="mt-1 text-[9px] font-bold leading-tight tracking-[0.08em] text-navy">
          {rank}
        </span>
      )}
    </span>
  );
}
