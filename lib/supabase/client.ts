import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

// This platform is multi-tenant: each school could eventually route to its
// own Supabase project/schema. For Sprint 1, a single shared project with a
// `school_id` column on relevant tables is enough - don't over-build the
// multi-tenancy layer before there's real data to justify it.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
