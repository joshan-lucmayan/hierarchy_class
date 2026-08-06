"use client";

import { useEffect, useState } from "react";
import type { ProfileRow } from "@/types/supabase";
import { createClient } from "@/lib/supabase/client";

interface UseMyProfileResult {
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
}

/** Fetches the profile row belonging to the currently logged in user. */
export function useMyProfile(): UseMyProfileResult {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    supabase.auth.getUser().then(async ({ data: userData, error: userError }) => {
      if (cancelled) return;
      if (userError || !userData.user) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (cancelled) return;
      if (profileError || !data) {
        setError("Couldn't load your profile.");
        setProfile(null);
      } else {
        setProfile(data as ProfileRow);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading, error };
}
