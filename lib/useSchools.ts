"use client";

import { useEffect, useState } from "react";
import { School } from "@/types/school";
import { createClient } from "@/lib/supabase/client";

// Public signup only shows schools the platform owner has registered AND
// opened for registration (active + registration_enabled). No school is
// hardcoded - the selector is always driven by the database.
interface UseSchoolsResult {
  schools: School[];
  loading: boolean;
  error: string | null;
}

export function useSchools(): UseSchoolsResult {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("schools")
      .select("id, name, abbreviation, active, registration_enabled")
      .eq("active", true)
      .eq("registration_enabled", true)
      .order("name")
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load the school list. Please refresh and try again.");
          setSchools([]);
        } else if (!data || data.length === 0) {
          setError("No schools are open for registration yet. Check back soon.");
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
