import { createServerClient } from "@supabase/ssr";
import type { Database, Role } from "@/types/supabase";

type CookieStore = {
  getAll: () => Array<{ name: string; value: string }>;
};

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Server-side read of the authenticated user's profile (role + school_id)
 * resolved from the `profiles` table - the database-truth source. Returns
 * null when there is no session or no profile row.
 */
export async function getServerProfile(cookieStore: CookieStore): Promise<{
  user: { id: string; emailConfirmed: boolean } | null;
  role: Role | null;
  schoolId: string | null;
}> {
  const url = getSupabaseUrl();
  const key = getAnonKey();

  if (!url || !key) {
    return { user: null, role: null, schoolId: null };
  }

  try {
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: async () =>
          cookieStore.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          })),
      },
    });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { user: null, role: null, schoolId: null };
    }

    // Note: this project's supabase-js types `.maybeSingle()` as `never`, so
    // results are cast - same convention as the rest of the codebase.
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("user_id", data.user.id)
      .maybeSingle()) as { data: { role: string; school_id: string } | null };

    return {
      user: {
        id: data.user.id,
        emailConfirmed: !!data.user.email_confirmed_at,
      },
      role: profile && isRole(profile.role) ? profile.role : null,
      schoolId: profile?.school_id ?? null,
    };
  } catch {
    return { user: null, role: null, schoolId: null };
  }
}

function isRole(value: unknown): value is Role {
  return value === "student" || value === "teacher" || value === "admin";
}

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return normalized === "teacher" || normalized === "admin" || normalized === "student"
    ? normalized
    : null;
}
