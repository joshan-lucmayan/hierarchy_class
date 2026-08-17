import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Server-only Supabase client with the service role. Used ONLY by the
// account-deletion path (deleting auth.users and removing storage objects) -
// never imported from a client component and never shipped to the browser.
//
// SECURITY: the key is read from the SUPABASE_SERVICE_ROLE_KEY env var, which
// is server-only (never NEXT_PUBLIC_, never committed). Callers must perform
// their own authorization BEFORE doing anything with this client.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
