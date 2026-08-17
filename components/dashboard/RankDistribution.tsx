"use client";

import { useMemo } from "react";
import { RANK_ORDER, type Rank } from "@/lib/rankEngine";
import type { StudentRankInfo } from "@/lib/rankStore";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Bar } from "@/components/ui/Bar";
import { Chip } from "@/components/ui/Chip";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";

const TIERS: Rank[] = ["D", "C", "B", "A", "S", "S+", "S++", "EX"];

/**
 * The tier's visual identity - the same token set the landing page's rank
 * ladder uses (bg-rank-* / text-rankText-* / border-rankBorder-*), so the
 * distribution reads as a progression ladder, not eight generic KPI tiles.
 */
const TIER_STYLES: Record<Rank, { tile: string; letter: string }> = {
  D: { tile: "border-rankBorder-d bg-rank-d", letter: "text-rankText-d" },
  C: { tile: "border-rankBorder-c bg-rank-c", letter: "text-rankText-c" },
  B: { tile: "border-rankBorder-b bg-rank-b", letter: "text-rankText-b" },
  A: { tile: "border-rankBorder-a bg-rank-a", letter: "text-rankText-a" },
  S: { tile: "border-rankBorder-s bg-rank-s", letter: "text-rankText-s" },
  "S+": { tile: "border-rankBorder-s bg-rank-s", letter: "text-rankText-s" },
  "S++": { tile: "border-rankBorder-splus bg-rank-splus", letter: "text-rankText-splus" },
  EX: { tile: "border-gold-token bg-gold-token", letter: "text-on-accent" },
};

/**
 * Rank distribution card - the "where does the school stand in the hierarchy"
 * signal. Pure counts + a mean bar from the rank engine's rows (never
 * recomputed from grades). Used school-wide on the admin home and filtered to
 * a teacher's own students on the teacher home.
 */
export function RankDistribution({
  ranks,
  title = "Hierarchy Health",
  topCount = 5,
  nameOf,
}: {
  ranks: StudentRankInfo[];
  title?: string;
  topCount?: number;
  nameOf?: (studentId: string) => string;
}) {
  const stats = useMemo(() => {
    const counts = new Map<Rank, number>();
    TIERS.forEach((t) => counts.set(t, 0));
    let ex = 0;
    let barSum = 0;
    let barCount = 0;
    for (const r of ranks) {
      const tier = TIERS.includes(r.current_rank) ? r.current_rank : "D";
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
      if (tier === "EX") ex += 1;
      else {
        barSum += r.current_bar;
        barCount += 1;
      }
    }
    const max = Math.max(...Array.from(counts.values()), 1);
    return { counts, total: ranks.length, ex, avgBar: barCount ? barSum / barCount : 0, max };
  }, [ranks]);

  const top = useMemo(() => {
    return [...ranks]
      .sort((a, b) => {
        const ra = RANK_ORDER.indexOf(a.current_rank);
        const rb = RANK_ORDER.indexOf(b.current_rank);
        if (rb !== ra) return rb - ra;
        const va = a.current_rank === "EX" ? a.ex_score : a.current_bar;
        const vb = b.current_rank === "EX" ? b.ex_score : b.current_bar;
        return vb - va;
      })
      .slice(0, topCount);
  }, [ranks, topCount]);

  return (
    <CornerFrame tone="gold" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <h2 className="section-label">{title}</h2>
        <Chip variant="gold">{stats.total} ranked</Chip>
      </div>

      {stats.total === 0 ? (
        <div className="px-5 pb-6 pt-4 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gold-soft text-gold-token">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M14 7h7v7" />
            </svg>
          </span>
          <p className="mt-3 font-mono-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-navy">
            No ranked students yet
          </p>
          <p className="mx-auto mt-1 max-w-[260px] text-xs leading-5 text-muted">
            Ranks appear once grades are approved. Approve pending submissions to start the ladder.
          </p>
        </div>
      ) : (
        <div className="p-5 pt-4">
          {/* Tier ladder: D -> EX as a progression, each tile carrying its rank identity */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {TIERS.map((tier, i) => {
              const count = stats.counts.get(tier) ?? 0;
              const style = TIER_STYLES[tier];
              return (
                <div
                  key={tier}
                  className="rounded-[8px] border bg-tile px-1 py-2.5 text-center"
                  title={`${tier}: ${count} student${count === 1 ? "" : "s"}`}
                >
                  <p
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold ${style.tile} ${style.letter}`}
                  >
                    {tier}
                  </p>
                  <p className="mt-1.5 text-[12px] font-semibold tabular-nums text-navy">{count}</p>
                  <span className="mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-line">
                    <span
                      className={`block h-full rounded-full ${i >= 4 ? "bg-gold-token" : "bg-sealion"}`}
                      style={{ width: `${Math.round((count / stats.max) * 100)}%` }}
                    />
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mean bar + EX count */}
          <div className="mt-3 flex items-center gap-3 rounded-[8px] border border-base bg-[var(--surface-strong)] px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Avg bar</span>
            <Bar value={stats.avgBar} tone="gold" className="flex-1" />
            <span className="text-[13px] font-bold tabular-nums text-navy">
              {Math.round(stats.avgBar)}
              <span className="text-[10px] font-normal text-faint">/100</span>
            </span>
            <Chip variant="gold">{stats.ex} EX</Chip>
          </div>

          {/* Top students */}
          <div className="mt-3.5 space-y-1.5">
            {top.map((r, i) => (
              <div key={r.student_id} className="flex items-center gap-2.5 rounded-[8px] border border-line bg-tile px-3 py-1.5">
                <span className="w-4 text-[11px] font-semibold tabular-nums text-faint">{i + 1}</span>
                <UserAvatar name={nameOf ? nameOf(r.student_id) : "Student"} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-navy">
                  {nameOf ? nameOf(r.student_id) : "Student"}
                </span>
                {r.current_rank === "EX" ? (
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-gold-token">
                    {Math.round(r.ex_score)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted">
                    {Math.round(r.current_bar)}
                    <span className="text-faint">/100</span>
                  </span>
                )}
                <RankBadge rank={r.current_rank} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
    </CornerFrame>
  );
}
