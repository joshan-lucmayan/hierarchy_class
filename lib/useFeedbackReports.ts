"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";

export interface FeedbackReport {
  id: string;
  page: string | null;
  message: string;
  attachment_paths: string[];
  created_at: string;
  user_name?: string | null;
}

interface UseFeedbackReportsResult {
  reports: FeedbackReport[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads feedback reports for the admin's school.
 * The RLS policy `feedback_reports_admin_read` gates this to admins only.
 */
export function useFeedbackReports(): UseFeedbackReportsResult {
  const { profile } = useMyProfile();
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();
    const schoolId = profile.school_id;

    async function load() {
      const { data, error: fetchError } = await supabase
        .from("feedback_reports")
        .select("*, reporter:profiles!user_id(full_name)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(50) as any;

      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load feedback reports.");
        setLoading(false);
        return;
      }

      setReports(
        ((data ?? []) as any[]).map((r: any) => ({
          id: r.id,
          page: r.page,
          message: r.message,
          attachment_paths: r.attachment_paths ?? [],
          created_at: r.created_at,
          user_name: r.reporter?.full_name ?? null,
        }))
      );
      setError(null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  return { reports, loading, error, refetch };
}