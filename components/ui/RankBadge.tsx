import { TierRank } from "@/types/student";

const RANK_KEY: Record<TierRank, string> = {
  "S++": "splus",
  S: "s",
  A: "a",
  B: "b",
  C: "c",
  D: "d",
};

const TIER_CLASSES: Record<string, string> = {
  splus: "bg-rank-splus text-rankText-splus border-rankBorder-splus",
  s: "bg-rank-s text-rankText-s border-rankBorder-s",
  a: "bg-rank-a text-rankText-a border-rankBorder-a",
  b: "bg-rank-b text-rankText-b border-rankBorder-b",
  c: "bg-rank-c text-rankText-c border-rankBorder-c",
  d: "bg-rank-d text-rankText-d border-rankBorder-d",
};

const SIZES = {
  sm: "h-6 min-w-6 px-1.5 text-[10px]",
  md: "h-8 min-w-8 px-2 text-xs",
  lg: "h-11 min-w-11 px-3 text-base",
};

interface RankBadgeProps {
  rank: TierRank;
  size?: keyof typeof SIZES;
  className?: string;
}

export function RankBadge({ rank, size = "md", className = "" }: RankBadgeProps) {
  const tier = RANK_KEY[rank];
  const tierClasses = TIER_CLASSES[tier];
  return (
    <span className={`inline-flex items-center justify-center rounded-md border font-bold ${SIZES[size]} ${tierClasses} ${className}`}>
      {rank}
    </span>
  );
}
