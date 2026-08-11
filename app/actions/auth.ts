"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

// Type for cookie objects set by Supabase
interface CookieToSet {
  name: string;
  value: string;
  options?: {
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
  };
}

export async function signUpWithProfile(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  schoolId: string,
  role: "student" | "teacher" | "admin",
  isLibrarian: boolean = false
) {
  const fullName = `${firstName} ${lastName}`.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { error: "Supabase not configured" };
  }

  try {
    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll: async () => {
          const cookieStore = await cookies();
          return cookieStore.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll: async (cookiesToSet: CookieToSet[]) => {
          const cookieStore = await cookies();
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    // Sign up user with Supabase Auth. The profile row (and florin balance,
    // for students) is created automatically by a database trigger
    // (see migrations/003_auto_create_profile.sql) that reads this same
    // metadata - it runs at the DB level regardless of whether email
    // confirmation is required, so there's no client-side RLS race here.
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          school_id: schoolId,
          first_name: firstName,
          last_name: lastName,
          name: fullName, // kept for backwards-compatible metadata readers
          role,
          is_librarian: isLibrarian,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
      },
    });

    if (signUpError || !authData.user) {
      return { error: signUpError?.message || "Signup failed" };
    }

    return { success: true, userId: authData.user.id };
  } catch (err) {
    console.error("Signup error:", err);
    return { error: "An unexpected error occurred" };
  }
}