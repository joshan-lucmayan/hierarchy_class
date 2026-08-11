"use client";

import { useEffect, useState } from "react";
import type { ProfileRow } from "@/types/supabase";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";

interface UseSchoolProfilesOptions {
  /** Only fetch profiles with this role. Omit to fetch every role. */
  role?: "student" | "teacher" | "admin";
  /** Exclude the signed-in user's own profile at the query level. */
  excludeSelf?: boolean;
  /** Skip the query entirely and return an empty list (e.g. a directory that
   *  only wants admins while an explicit search is active). */
  enabled?: boolean;
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
  const { role, excludeSelf, enabled = true } = options;
  const { profile: me } = useMyProfile();
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

    if (!enabled) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    let query = supabase.from("profiles").select("*").order("full_name");
    if (role) query = query.eq("role", role);
    if (excludeSelf && me?.id) query = query.neq("id", me.id);

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
  }, [role, excludeSelf, enabled, me?.id, refetchTick]);

  function refetch() {
    setLoading(true);
    setRefetchTick((t) => t + 1);
  }

  return { profiles, loading, error, refetch };
}
