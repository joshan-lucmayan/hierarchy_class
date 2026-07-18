import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

type CookieStore = {
  getAll: () => Array<{ name: string; value: string }>;
};

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function getUserMetadata(cookieStore: CookieStore) {
  const url = getSupabaseUrl();
  const key = getAnonKey();

  if (!url || !key) {
    return null;
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
      return null;
    }

    return data.user.user_metadata as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

export function normalizeRole(value: unknown): "student" | "teacher" | "admin" | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return normalized === "teacher" || normalized === "admin" || normalized === "student" ? normalized : null;
}