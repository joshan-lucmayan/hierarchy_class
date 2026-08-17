import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Server-only Supabase client with the service role. Used by:
//   - the account-deletion path (deleting auth.users + storage objects)
//   - the signup duplicate-identifier pre-check (read-only profiles lookup)
//   - the developer admin-provisioning script (scripts/provision-admin.mjs)
// Never imported from a client component and never shipped to the browser.
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
