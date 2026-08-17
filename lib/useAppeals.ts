"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import type { AccountAppealRow } from "@/types/supabase";

interface UseAppealsResult {
  appeals: AccountAppealRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Admin view of the account-appeal queue at their school. RLS
 * (appeals_admin_all) scopes reads to the admin's own school; approve/deny
 * runs through the server action `resolveAppeal` which re-verifies the same
 * school and admin role.
 */
export function useAppeals(): UseAppealsResult {
  const { profile } = useMyProfile();
  const [appeals, setAppeals] = useState<AccountAppealRow[]>([]);
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
    supabase
      .from("account_appeals")
      .select("*, user:profiles!user_id(full_name, role)")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load appeals.");
          setAppeals([]);
        } else {
          setAppeals(
            ((data ?? []) as any[]).map((r: any) => ({
              id: r.id,
              school_id: r.school_id,
              user_id: r.user_id,
              user_name: r.user?.full_name ?? null,
              reason: r.reason,
              status: r.status,
              reviewed_by: r.reviewed_by,
              reviewed_at: r.reviewed_at,
              created_at: r.created_at,
            }))
          );
          setError(null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { appeals, loading, error, refetch };
}
