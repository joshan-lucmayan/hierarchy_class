import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, Role } from "@/types/supabase";
import { decideAuthRoute, type AuthProfile } from "@/lib/authz";

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

// Runs on (almost) every request. Two jobs:
// 1. Keep the Supabase session cookie fresh (required by @supabase/ssr).
// 2. Enforce that /student, /teacher, /admin are only reachable by a logged
//    in user whose PROFILES row matches - role and school come from the
//    database (profiles.role / profiles.school_id), never from
//    auth.users.user_metadata (which the user can edit themselves).
//    Also enforces email confirmation and the deactivated-account lifecycle.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not configured yet (e.g. still doing UI-only local work) -
  // don't block anything, matches the "fake auth bypass" the rest of the
  // app already falls back to when these env vars are missing.
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Resolve the caller's profile from the DATABASE (profiles.user_id), not
  // from user_metadata. This single query also covers deactivation.
  // (Note: supabase-js types `.maybeSingle()` as `never` here, so the result
  // is cast - same convention as the rest of the codebase.)
  let profile: AuthProfile | null = null;
  if (user) {
    const { data: profileRow } = (await supabase
      .from("profiles")
      .select("role, school_id, deactivated_at, restricted_at")
      .eq("user_id", user.id)
      .maybeSingle()) as {
      data: { role: string; school_id: string; deactivated_at: string | null; restricted_at: string | null } | null;
    };
    if (profileRow) {
      const role = profileRow.role as Role;
      if (role === "student" || role === "teacher" || role === "admin") {
        profile = {
          role,
          school_id: profileRow.school_id,
          deactivated_at: profileRow.deactivated_at,
          restricted_at: profileRow.restricted_at,
        };
      }
    }
  }

  const decision = decideAuthRoute({
    pathname,
    isAuthenticated: !!user,
    emailConfirmed: !!user?.email_confirmed_at,
    profile,
  });

  if (decision.type === "redirect") {
    // Bounce wrong-role users to their own home (their own role's home only
    // exists for known roles - the profile check guarantees that here).
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|offline|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
