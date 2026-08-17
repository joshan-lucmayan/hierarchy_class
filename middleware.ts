import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

const ROLE_PREFIXES: Record<string, "student" | "teacher" | "admin"> = {
  "/student": "student",
  "/teacher": "teacher",
  "/admin": "admin",
};

// Runs on (almost) every request. Two jobs:
// 1. Keep the Supabase session cookie fresh (required by @supabase/ssr).
// 2. Enforce that /student, /teacher, /admin are only reachable by a logged
//    in user whose role matches - logged out visitors bounce to /login,
//    wrong-role visitors bounce to their own home instead of seeing a
//    section that isn't theirs.
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

  const supabase = createServerClient(url, anonKey, {
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
  const matchedPrefix = Object.keys(ROLE_PREFIXES).find((prefix) => pathname.startsWith(prefix));

  // Deactivated accounts: server-side enforcement. A signed-in user whose
  // profile is deactivated can only reach the minimal auth/reactivation flow
  // (/auth/reactivate, login/signup so they can sign out, and API routes that
  // do their own auth). Everything else bounces to the reactivation screen.
  // This runs on the server for every request, so hiding UI alone can never
  // bypass it.
  if (user && !pathname.startsWith("/api/") && pathname !== "/auth/reactivate" && pathname !== "/auth/callback" && pathname !== "/forgot-password" && pathname !== "/reset-password") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("deactivated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.deactivated_at) {
      // Deactivated users only ever land on the minimal reactivation flow -
      // login/signup included, so they can reactivate or sign out.
      return NextResponse.redirect(new URL("/auth/reactivate", request.url));
    }
  }

  if (matchedPrefix && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (matchedPrefix && user) {
    const metadataRole = user.user_metadata?.role;
    const role = typeof metadataRole === "string" ? metadataRole : null;
    const requiredRole = ROLE_PREFIXES[matchedPrefix];

    if (role && role !== requiredRole) {
      return NextResponse.redirect(new URL(`/${role}/home`, request.url));
    }
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const metadataRole = user.user_metadata?.role;
    const role = typeof metadataRole === "string" ? metadataRole : "student";
    return NextResponse.redirect(new URL(`/${role}/home`, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
