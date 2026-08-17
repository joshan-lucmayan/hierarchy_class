"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import type { AccountRequestRow } from "@/types/supabase";

interface UseAccountRequestsResult {
  requests: AccountRequestRow[];
  loading: boolean;
  error: string | null;
  /** Student/teacher side: submit a deletion request (deactivation is now self-service). */
  request: (type: "deletion", reason?: string) => Promise<boolean>;
  refetch: () => void;
}

/**
 * Admin view of deletion requests at their school. Deactivation is
 * self-service now (no request row), so the admin queue only surfaces
 * deletion requests. Approve/deny run through the server action
 * `resolveDeletionRequest` (school + role verified server-side).
 */
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
      .eq("type", "deletion")
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

  const request = useCallback(
    async (type: "deletion", reason?: string): Promise<boolean> => {
      if (!profile) return false;
      const supabase = createClient();
      const { error } = await supabase.from("account_requests").insert({
        school_id: profile.school_id,
        requester_id: profile.id,
        type,
        reason: reason?.trim() || null,
      } as any);
      return !error;
    },
    [profile]
  );

  return { requests, loading, error, request, refetch };
}
