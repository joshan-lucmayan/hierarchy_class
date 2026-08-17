/**
 * Route authorization decision logic (pure, unit-tested in
 * lib/authz.test.ts).
 *
 * The authoritative source of role and school is the `profiles` row in the
 * database - NEVER auth.users.user_metadata. A user who edits their own
 * user_metadata cannot change what these checks see, because the caller
 * resolves the profile from profiles.user_id = auth user id.
 */

import type { Role } from "@/types/supabase";

export interface AuthProfile {
  role: Role;
  school_id: string;
  deactivated_at: string | null;
  /** Set by a school admin for suspicious accounts. Restricted users can
   *  only reach /auth/restricted (appeal) - separate from deactivated_at. */
  restricted_at: string | null;
}

export interface AuthContext {
  pathname: string;
  isAuthenticated: boolean;
  /** user.email_confirmed_at - enforced server-side, not just in the UI. */
  emailConfirmed: boolean;
  /** Resolved from profiles by user_id (database truth), null if missing. */
  profile: AuthProfile | null;
}

export type AuthDecision =
  | { type: "next" }
  | { type: "redirect"; to: string };

export const ROLE_PREFIXES: Record<string, Role> = {
  "/student": "student",
  "/teacher": "teacher",
  "/admin": "admin",
};

export function homePathForRole(role: Role): string {
  return `/${role}/home`;
}

/**
 * Decides what the middleware should do for a request.
 *
 * Order matters:
 *  1. Unauthenticated on a role prefix -> /login (preserving the destination).
 *  2. Deactivated account -> locked to the reactivation flow.
 *  3. Authenticated but NO profile -> /auth/incomplete (never silently allow,
 *     never auto-create a profile from client data).
 *  4. Unverified email -> confirmation required, no application access.
 *  5. Role prefix vs profiles.role -> wrong role bounces to own home.
 *  6. Signed-in users on /login or /signup -> their own home.
 */
export function decideAuthRoute(ctx: AuthContext): AuthDecision {
  const { pathname, isAuthenticated, emailConfirmed, profile } = ctx;

  const matchedPrefix = Object.keys(ROLE_PREFIXES).find((prefix) =>
    pathname.startsWith(prefix)
  );

  // 1) Unauthenticated.
  if (!isAuthenticated) {
    if (matchedPrefix) {
      return { type: "redirect", to: `/login?next=${encodeURIComponent(pathname)}` };
    }
    return { type: "next" };
  }

  // 1b) Restricted accounts (school-admin action for suspicious users): the
  //     user can authenticate but only reach the restriction/appeal state.
  //     Checked BEFORE deactivation so a restricted account always lands on
  //     the appeal flow regardless of other lifecycle flags.
  if (profile?.restricted_at) {
    const allowed =
      pathname.startsWith("/api/") ||
      pathname === "/auth/restricted" ||
      pathname === "/auth/callback" ||
      pathname === "/logout" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password";
    return allowed ? { type: "next" } : { type: "redirect", to: "/auth/restricted" };
  }

  // 2) Deactivated accounts: only the minimal lifecycle flow is reachable.
  if (profile?.deactivated_at) {
    const allowed =
      pathname.startsWith("/api/") ||
      pathname === "/auth/reactivate" ||
      pathname === "/auth/callback" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password";
    return allowed ? { type: "next" } : { type: "redirect", to: "/auth/reactivate" };
  }

  // 3) Authenticated but no profile row - a broken/partial account.
  if (!profile) {
    if (pathname.startsWith("/api/") || pathname === "/auth/incomplete") {
      return { type: "next" };
    }
    return { type: "redirect", to: "/auth/incomplete" };
  }

  // 4) Email must be confirmed for application access. Login/signup stay
  //    reachable so the user can resend the confirmation or sign out.
  if (!emailConfirmed) {
    if (pathname.startsWith("/api/") || pathname === "/auth/callback") {
      return { type: "next" };
    }
    if (pathname === "/login" || pathname === "/signup") {
      return { type: "next" };
    }
    return { type: "redirect", to: "/login?unverified=1" };
  }

  // 5) Role prefix routing from profiles.role.
  if (matchedPrefix) {
    if (profile.role !== ROLE_PREFIXES[matchedPrefix]) {
      return { type: "redirect", to: homePathForRole(profile.role) };
    }
    return { type: "next" };
  }

  // 6) Signed-in users don't need the login/signup pages.
  if (pathname === "/login" || pathname === "/signup") {
    return { type: "redirect", to: homePathForRole(profile.role) };
  }

  return { type: "next" };
}
