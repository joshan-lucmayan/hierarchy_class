"use client";

import { useEffect, useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { RankBadge } from "@/components/ui/RankBadge";
import { useMyProfile } from "@/lib/useMyProfile";
import { createClient } from "@/lib/supabase/client";

/**
 * Season history - peak rank per season for a student, rendered from the
 * `get_season_history` RPC. Extracted from the profile page so it can be
 * shown in the profile card's three-dot menu (own profile) or anywhere a
 * student id is available. Markup is preserved from the original profile
 * card; this is a relocation, not a redesign.
 */
export function SeasonHistory({ studentId }: { studentId?: string }) {
  const { profile } = useMyProfile();
  const targetId = studentId ?? profile?.id;
  const [seasonHistory, setSeasonHistory] = useState<any[] | null>(null);

  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    const supabase = createClient();
    (supabase as any)
      .rpc("get_season_history", { p_student_id: targetId })
      .then(({ data, error: rpcError }: any) => {
        if (cancelled) return;
        if (!rpcError) setSeasonHistory((data ?? []) as any[]);
      });
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Season history</h2>
      {seasonHistory === null ? (
        <p className="text-sm text-muted">Loading seasons...</p>
      ) : seasonHistory.length === 0 ? (
        <p className="text-sm text-muted">No seasons recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {seasonHistory.map((s: any) => (
            <div key={s.season_id} className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    {[s.school_year, s.semester_label].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[s.grade_level, s.strand_or_track, s.section].filter(Boolean).join(" · ") || "-"}
                  </p>
                </div>
                <RankBadge rank={s.peak_rank} size="sm" />
              </div>
              {s.ex_achieved && (
                <p className="mt-2 text-[11px] text-muted">EX achieved</p>
              )}
            </div>
          ))}
        </div>
      )}
    </CornerFrame>
  );
}
