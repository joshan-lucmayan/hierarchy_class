"use client";

import { useEffect, useState } from "react";
import type { ProfileRow } from "@/types/supabase";
import { createClient } from "@/lib/supabase/client";

interface UseSchoolProfilesOptions {
  /** Only fetch profiles with this role. Omit to fetch every role. */
  role?: "student" | "teacher" | "admin";
}

interface UseSchoolProfilesResult {
  profiles: ProfileRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches every profile at the current user's own school (RLS enforces this
 * boundary server-side via migrations/004_profiles_school_read.sql - a
 * logged in user can only ever see rows where school_id matches their own
 * JWT metadata, so there's no risk of leaking another school's roster here
 * even though this hook itself doesn't pass a school_id).
 */
export function useSchoolProfiles(options: UseSchoolProfilesOptions = {}): UseSchoolProfilesResult {
  const { role } = options;
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    let query = supabase.from("profiles").select("*").order("full_name");
    if (role) query = query.eq("role", role);

    query.then(({ data, error: fetchError }) => {
      if (cancelled) return;
      if (fetchError) {
        setError("Couldn't load the roster. Please refresh and try again.");
        setProfiles([]);
      } else {
        setProfiles((data as ProfileRow[]) ?? []);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [role, refetchTick]);

  function refetch() {
    setLoading(true);
    setRefetchTick((t) => t + 1);
  }

  return { profiles, loading, error, refetch };
}
