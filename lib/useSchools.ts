"use client";

import { useEffect, useState } from "react";
import { School } from "@/types/school";
import { createClient } from "@/lib/supabase/client";

// The platform is currently deployed for a single institution: CSA.
// The schools table is filtered to CSA so no other institution ever appears
// in selectors. Fallback data mirrors the same single-school behavior so the
// UI stays testable offline.
const CSA_ONLY_FALLBACK: School[] = [
  { id: "csa", name: "CSA - College of Saint Amateil", abbreviation: "CSA" },
];

interface UseSchoolsResult {
  schools: School[];
  loading: boolean;
  error: string | null;
}

export function useSchools(): UseSchoolsResult {
  const [schools, setSchools] = useState<School[]>(CSA_ONLY_FALLBACK);
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
      .select("id, name, abbreviation")
      .eq("active", true)
      .order("name")
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load the school list. Please refresh and try again.");
          setSchools([]);
        } else if (!data || data.length === 0) {
          setError("No schools are set up yet. Ask your admin to run the schools seed script.");
          setSchools([]);
        } else {
          // CSA is the only active institution - other schools may exist in
          // the table for future tenancy, but are never exposed.
          const csa = (data as School[]).filter((s) => s.abbreviation === "CSA");
          setSchools(csa.length > 0 ? csa : [(data as School[])[0]]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { schools, loading, error };
}
