"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import type { AccountRequestRow } from "@/types/supabase";

interface UseAccountRequestsResult {
  requests: AccountRequestRow[];
  loading: boolean;
  error: string | null;
  resolve: (id: string, status: "approved" | "denied") => Promise<void>;
  refetch: () => void;
}

/** Admin view of pending deactivation/deletion requests at their school. */
export function useAccountRequests(): UseAccountRequestsResult {
  const { profile } = useMyProfile();
  const [requests, setRequests] = useState<AccountRequestRow[]>([]);
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
      .from("account_requests")
      .select("*, requester:profiles!requester_id(full_name, role)")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load account requests.");
          setRequests([]);
        } else {
          setRequests(
            ((data ?? []) as any[]).map((r: any) => ({
              id: r.id,
              school_id: r.school_id,
              requester_id: r.requester_id,
              requester_name: r.requester?.full_name ?? null,
              requester_role: r.requester?.role ?? null,
              type: r.type,
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

  const resolve = useCallback(
    async (id: string, status: "approved" | "denied") => {
      if (!profile) return;
      const supabase = createClient();
      await (supabase.from("account_requests") as any)
        .update({
          status,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      refetch();
    },
    [profile, refetch]
  );

  return { requests, loading, error, resolve, refetch };
}
