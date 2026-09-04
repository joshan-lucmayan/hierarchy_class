"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { randomId } from "@/lib/randomId";
import { RANK_ORDER, type Rank } from "@/lib/rankEngine";

const RANKS: readonly string[] = RANK_ORDER;

export interface StudentRankInfo {
  student_id: string;
  /** In-play rank for the current season (D..EX). */
  current_rank: Rank;
  /** 0-100 bar toward the next rank; meaningless when current_rank === "EX". */
  current_bar: number;
  /** Open-ended EX score (uncapped); only meaningful when current_rank === "EX". */
  ex_score: number;
  /** Season high-water mark. */
  peak_rank_this_season: Rank;
  /** All-time peak (monotonic). */
  highest_rank_ever: Rank;
  highest_rank_season: string | null;
  /** Current grading period label (category totals accumulate per period). */
  period_id: string | null;
}

interface RankContextValue {
  ranks: StudentRankInfo[];
  loading: boolean;
  error: string | null;
  /** Rank state for one student, or null when they have no rank row yet. */
  rankOf: (profileId: string) => StudentRankInfo | null;
  /** All rank rows sorted best-first (rank order desc, then bar/ex_score desc). */
  sorted: StudentRankInfo[];
  refetch: () => void;
}

const RankContext = createContext<RankContextValue | null>(null);

/**
 * School-wide rank provider, mirroring the florinStore pattern. Reads
 * student_rank_state directly (RLS scopes reads to the caller's school) and
 * refetches on realtime changes, so rank cards/leaderboards update live when a
 * score entry is confirmed or a season ends. Mounted once in app/layout.tsx.
 */
export function RankProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [ranks, setRanks] = useState<StudentRankInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    (supabase.from("student_rank_state").select("*") as any)
      .then(({ data, error: fetchError }: any) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load ranks.");
          setRanks([]);
        } else {
          setRanks(
            ((data ?? []) as any[]).map((r: any) => ({
              student_id: r.student_id,
              current_rank: (RANKS.includes(r.current_rank) ? r.current_rank : "D") as Rank,
              current_bar: Number(r.current_bar ?? 0),
              ex_score: Number(r.ex_score ?? 0),
              peak_rank_this_season: (RANKS.includes(r.peak_rank_this_season) ? r.peak_rank_this_season : "D") as Rank,
              highest_rank_ever: (RANKS.includes(r.highest_rank_ever) ? r.highest_rank_ever : "D") as Rank,
              highest_rank_season: r.highest_rank_season ?? null,
              period_id: r.period_id ?? null,
            }))
          );
          setError(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load ranks.");
        setRanks([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, tick]);

  // Realtime refetch. Unique channel per instance so multiple mounted stores
  // never collide (same pattern as useLeaderboard). RLS filters the events.
  useEffect(() => {
    if (!supabaseConfigured || !profile) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`rank-state-${randomId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "student_rank_state" }, () => {
        setTick((t) => t + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabaseConfigured, profile]);

  const rankOf = useCallback(
    (profileId: string) => ranks.find((r) => r.student_id === profileId) ?? null,
    [ranks]
  );

  const sorted = useMemo(() => {
    return [...ranks].sort((a, b) => {
      const ra = RANK_ORDER.indexOf(a.current_rank);
      const rb = RANK_ORDER.indexOf(b.current_rank);
      if (rb !== ra) return rb - ra;
      const va = a.current_rank === "EX" ? a.ex_score : a.current_bar;
      const vb = b.current_rank === "EX" ? b.ex_score : b.current_bar;
      return vb - va;
    });
  }, [ranks]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return (
    <RankContext.Provider value={{ ranks, loading, error, rankOf, sorted, refetch }}>
      {children}
    </RankContext.Provider>
  );
}

export function useRankStore(): RankContextValue {
  const ctx = useContext(RankContext);
  if (!ctx) throw new Error("useRankStore must be used within a RankProvider");
  return ctx;
}
