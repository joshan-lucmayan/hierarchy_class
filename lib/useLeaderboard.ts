"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import type { TierRank } from "@/lib/classroomHierarchyStore";

export interface LeaderboardEntry {
  studentId: string;
  fullName: string;
  avatarUrl: string | null;
  levelLabel: string | null;
  educationalLevel: string | null;
  section: string | null;
  programName: string | null;
  academicExcellence: number | null;
}

export function rankFromAverage(avg: number | null): TierRank {
  if (avg === null) return "D";
  if (avg >= 97) return "S++";
  if (avg >= 90) return "S";
  if (avg >= 80) return "A";
  if (avg >= 70) return "B";
  if (avg >= 60) return "C";
  return "D";
}

interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** Rank (1-based) of a student, or 0 when not ranked. */
  positionOf: (profileId: string) => number;
  /** Aggregate average for a student, or null. */
  averageOf: (profileId: string) => number | null;
}

/**
 * School standings for the caller's school. Backed by the
 * get_school_leaderboard SECURITY DEFINER function - only aggregates, never
 * individual grade rows, so it works under the hardened grade_entries RLS.
 */
export function useLeaderboard(): UseLeaderboardResult {
  const { profile } = useMyProfile();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    (supabase as any)
      .rpc("get_school_leaderboard")
      .then(({ data, error: rpcError }: any) => {
        if (cancelled) return;
        if (rpcError) {
          setError("Couldn't load the leaderboard.");
          setEntries([]);
        } else {
          setEntries(
            ((data ?? []) as any[]).map((r: any) => ({
              studentId: r.student_id,
              fullName: r.full_name,
              avatarUrl: r.avatar_url,
              levelLabel: r.level_label,
              educationalLevel: r.educational_level ?? null,
              section: r.section ?? null,
              programName: r.program_name ?? null,
              academicExcellence: r.academic_excellence !== null ? Number(r.academic_excellence) : null,
            }))
          );
          setError(null);
        }
        setLoading(false);
      });

    // Realtime: grade INSERT/UPDATE events (teacher submits, admin approves)
    // refresh the standings immediately. RLS scopes the events this user can
    // see; combined with the focus refresh below, rankings stay current.
    const channel = supabase
      .channel("leaderboard-grades")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grade_entries" },
        () => {
          if (!cancelled) setTick((t) => t + 1);
        }
      )
      .subscribe();

    // Refresh when the tab regains focus so freshly approved grades show up
    // without needing a manual reload.
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [supabaseConfigured, profile, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const positionOf = useCallback(
    (profileId: string) => entries.findIndex((e) => e.studentId === profileId) + 1,
    [entries]
  );
  const averageOf = useCallback(
    (profileId: string) => entries.find((e) => e.studentId === profileId)?.academicExcellence ?? null,
    [entries]
  );

  return { entries, loading, error, refetch, positionOf, averageOf };
}
