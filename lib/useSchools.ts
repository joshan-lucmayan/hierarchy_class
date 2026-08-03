"use client";

import { useEffect, useState } from "react";
import { School } from "@/types/school";
import { MOCK_SCHOOLS } from "@/data/schools";
import { createClient } from "@/lib/supabase/client";

interface UseSchoolsResult {
  schools: School[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the real schools table (with real UUID primary keys) from Supabase.
 * Falls back to MOCK_SCHOOLS only when Supabase isn't configured yet, so the
 * login/signup UI stays testable offline. Once Supabase is configured, this
 * always uses live data - never the mock slugs - so school.id is guaranteed
 * to be a real uuid that matches what's stored in profiles.school_id.
 */
export function useSchools(): UseSchoolsResult {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseConfigured) {
      setSchools(MOCK_SCHOOLS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("schools")
      .select("id, name, abbreviation")
      .eq("active", true)
      .order("name")
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load the list of schools. Please refresh and try again.");
          setSchools([]);
        } else if (!data || data.length === 0) {
          setError("No schools are set up yet. Ask your admin to add one, or run the schools seed script.");
          setSchools([]);
        } else {
          setSchools(data as School[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { schools, loading, error };
}
