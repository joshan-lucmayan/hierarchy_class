"use client";

import { useId } from "react";
import { TierRank } from "@/types/student";

const PILL_STYLES: Record<TierRank, { bg: string; text: string; border: string }> = {
  "S++": { bg: "#0b0f2e", text: "#c9962c", border: "#c9962c" },
  S: { bg: "#c9962c", text: "#ffffff", border: "#c9962c" },
  A: { bg: "#e6f1fb", text: "#185fa5", border: "#85b7eb" },
  B: { bg: "#eaf3de", text: "#3b6d11", border: "#97c459" },
  C: { bg: "#f1efe8", text: "#5f5e5a", border: "#b4b2a9" },
  D: { bg: "#fcebeb", text: "#a32d2d", border: "#f09595" },
};

const SHIELD_STYLES: Record<TierRank, { fill: string; stroke: string; star: string; legendary: boolean }> = {
  D: { fill: "#a3673a", stroke: "#7a4b28", star: "#e8c48a", legendary: false },
  C: { fill: "#8b95a3", stroke: "#5f6b78", star: "#e2e7ec", legendary: false },
  B: { fill: "#3b6d11", stroke: "#254608", star: "#c9e896", legendary: false },
  A: { fill: "#185fa5", stroke: "#0f3d6b", star: "#bfe0ff", legendary: false },
  S: { fill: "#c9962c", stroke: "#8f6a1e", star: "#fff2cf", legendary: true },
  "S++": { fill: "#0b0f2e", stroke: "#c9962c", star: "#c9962c", legendary: true },
};

const PILL_SIZES = { sm: "h-6 min-w-6 px-1.5 text-[10px]", md: "h-8 min-w-8 px-2 text-xs", lg: "h-11 min-w-11 px-3 text-base" };
const SHIELD_SIZES = { md: 64, lg: 100 };

const CX = 32;
const CY = 41;

interface RankBadgeProps {
  rank: TierRank;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function Sparkle({ x, y, size, delay, uid }: { x: number; y: number; size: number; delay: number; uid: string }) {
  return (
    <path
      d={`M${x} ${y - size} L${x + size * 0.3} ${y - size * 0.3} L${x + size} ${y} L${x + size * 0.3} ${y + size * 0.3} L${x} ${y + size} L${x - size * 0.3} ${y + size * 0.3} L${x - size} ${y} L${x - size * 0.3} ${y - size * 0.3} Z`}
      fill="#c9962c"
      opacity="0"
    >
      <animate
        attributeName="opacity"
        values="0;1;0"
        dur="1.8s"
        begin={`${delay}s`}
        repeatCount="indefinite"
        id={`${uid}-sp-${x}-${y}`}
      />
    </path>
  );
}

function ShieldIcon({ rank, size }: { rank: TierRank; size: number }) {
  const uid = useId();
  const style = SHIELD_STYLES[rank];
  const isUltra = rank === "S++";
  const scale = size / 64;

  return (
    <svg width={size} height={size * 1.15625} viewBox="0 0 64 74">
      <defs>
        <clipPath id={`${uid}-clip`}>
          <path d="M32 16 L50 22 L50 38 C50 52 42 62 32 66 C22 62 14 52 14 38 L14 22 Z" />
        </clipPath>
      </defs>

      {style.legendary && (
        <>
          <g opacity="0.35">
            <g transform={`translate(${CX} ${CY})`}>
              {Array.from({ length: 12 }).map((_, i) => (
                <rect key={i} x="-1" y="-40" width="2" height="16" fill="#c9962c" transform={`rotate(${i * 30})`} />
              ))}
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 0 0`}
                to={`360 0 0`}
                dur="26s"
                repeatCount="indefinite"
                additive="sum"
              />
            </g>
          </g>

          <circle cx={CX} cy={CY} r="26" fill="none" stroke="#c9962c" strokeWidth="1.5" opacity="0.5">
            <animate attributeName="r" values="24;30;24" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.55;0.1;0.55" dur="2.4s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {style.legendary && (
        <>
          <path d="M14 24 C0 26 -6 42 2 54 C8 48 13 40 15 32 Z" fill={style.fill} stroke={style.stroke} strokeWidth="1.5" />
          <path d="M50 24 C64 26 70 42 62 54 C56 48 51 40 49 32 Z" fill={style.fill} stroke={style.stroke} strokeWidth="1.5" />
        </>
      )}

      {style.legendary && (
        <>
          <path d="M22 58 L20 74 L27 68 L32 74 L27 58 Z" fill={isUltra ? "#0b0f2e" : "#8f6a1e"} stroke={style.stroke} strokeWidth="1" />
          <path d="M42 58 L44 74 L37 68 L32 74 L37 58 Z" fill={isUltra ? "#0b0f2e" : "#8f6a1e"} stroke={style.stroke} strokeWidth="1" />
        </>
      )}

      {isUltra && (
        <path d="M22 12 L25.5 19 L32 9 L38.5 19 L42 12 L39.5 22 L24.5 22 Z" fill="#c9962c" stroke="#8f6a1e" strokeWidth="1" />
      )}
      {rank === "S" && <path d="M26 12 L32 6 L38 12 L32 16 Z" fill="#fff2cf" stroke={style.stroke} strokeWidth="1" />}

      <path
        d="M32 16 L50 22 L50 38 C50 52 42 62 32 66 C22 62 14 52 14 38 L14 22 Z"
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth="2"
      />

      {style.legendary && (
        <g clipPath={`url(#${uid}-clip)`}>
          <rect x="-30" y="10" width="14" height="70" fill="#ffffff" opacity="0.25" transform="rotate(20 32 41)">
            <animate attributeName="x" values="-30;70" dur="3s" repeatCount="indefinite" begin="0s" />
          </rect>
        </g>
      )}

      {style.legendary && (
        <path
          d="M32 20 L48 25 L48 38 C48 50 41 59 32 63"
          fill="none"
          stroke={isUltra ? "#c9962c" : "#fff2cf"}
          strokeWidth="0.75"
          opacity="0.5"
        />
      )}

      <path
        d="M32 30 L34.5 36.5 L41 37 L36 41.5 L37.5 48 L32 44.5 L26.5 48 L28 41.5 L23 37 L29.5 36.5 Z"
        fill={style.star}
      />

      {style.legendary && (
        <>
          <Sparkle x={8} y={20} size={4} delay={0} uid={uid} />
          <Sparkle x={56} y={20} size={4} delay={0.7} uid={uid} />
          <Sparkle x={32} y={2} size={3.5} delay={1.4} uid={uid} />
          {isUltra && <Sparkle x={32} y={70} size={3.5} delay={0.35} uid={uid} />}
        </>
      )}
    </svg>
  );
}

export function RankBadge({ rank, size = "md", className = "" }: RankBadgeProps) {
  if (size === "sm") {
    const style = PILL_STYLES[rank];
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md border font-bold ${PILL_SIZES.sm} ${className}`}
        style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
      >
        {rank}
      </span>
    );
  }

  const isLegendary = SHIELD_STYLES[rank].legendary;

  return (
    <div className={`animate-badge-pop flex flex-col items-center gap-1 ${className}`}>
      <ShieldIcon rank={rank} size={SHIELD_SIZES[size]} />
      <span className={`text-xs font-bold uppercase tracking-wide text-navy ${isLegendary ? "animate-label-glow" : ""}`}>
        {rank}
      </span>
    </div>
  );
}
