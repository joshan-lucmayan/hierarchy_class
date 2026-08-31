"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { createClient } from "@/lib/supabase/client";
import { homePathForRole } from "@/lib/authz";
import {
  isNativeApp,
  cachedNativeRole,
  cacheNativeRole,
  clearNativeRole,
  hasPendingAuthLink,
} from "@/lib/native";
import { registerBackHandler } from "@/lib/nativeBackHandler";
import { NativeEntry } from "@/components/native/NativeEntry";
import type { Role } from "@/types/supabase";

/**
 * Authentication boot gate for the standalone Android app.
 *
 * The Android export has no edge middleware and no server: "/" is the static
 * NativeEntry boot HTML, and this client gate owns the cold-start auth
 * decision — the exact equivalent of the web's app/page.tsx redirect +
 * middleware rules (lib/authz.ts decideAuthRoute), so both platforms follow
 * one flow:
 *
 *   1. getSession()            — local, no network. No session → Login screen
 *                                (fresh install / signed out) with zero delay.
 *   2. getUser()               — network validation + token refresh of the
 *                                persisted session.
 *   3. profiles row            — database truth for role/deactivated/
 *                                restricted (never user_metadata), mirroring
 *                                decideAuthRoute's priority: restricted →
 *                                /auth/restricted, deactivated →
 *                                /auth/reactivate, no profile →
 *                                /auth/incomplete, unverified email →
 *                                /login?unverified=1, else → role home.
 *   4. Offline with a session  — getUser() can't be validated, so the last
 *                                known role (lib/native.ts role cache) routes
 *                                the user to their home; the role pages show
 *                                their own offline errors. No logout happens.
 *   5. Online auth rejection   — the stored session is expired/invalid:
 *                                signOut() clears it (plus the role cache)
 *                                and the Login screen is shown.
 *
 * There is no separate entry chooser: when no valid session exists the gate
 * routes directly to the Login screen, which owns the "Welcome back"
 * greeting and the Create an Account link. NativeEntry is only a transient
 * boot state (logo + spinner) while the session resolves.
 *
 * Hydration: the FIRST client render is the static export HTML of "/"
 * (NativeEntry boot state) — no mismatch, no landing flash. Every state
 * change happens after mount.
 *
 * Rendered by app/page.tsx ONLY in the Android export build (CAPACITOR_EXPORT
 * =1); the web deployment never mounts it.
 */
export function NativeRootGate() {
  const router = useRouter();
  const [resolving, setResolving] = useState(true);

  // While the boot state is up (session still resolving) the gate IS the app
  // root: hardware back exits the app. Unregisters as soon as the gate
  // unmounts (the Login/role-home navigation happens via router.replace).
  useEffect(() => {
    if (!resolving) return;
    return registerBackHandler(() => {
      void App.exitApp();
      return true;
    });
  }, [resolving]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let disposed = false;
    const supabase = createClient();

    function goToLogin(params?: string) {
      if (disposed) return;
      clearNativeRole();
      router.replace(params ? `/login?${params}` : "/login");
    }

    async function boot() {
      // Cold-start auth deep link (password recovery / confirmation): the
      // NativeDeepLink handler (root layout) owns the exchange and will
      // navigate away (unmounting this gate). Stay in the boot state instead
      // of showing the login screen or routing to a role home.
      if (hasPendingAuthLink()) return;

      // 1) Local session check (no network): fast path for signed-out users.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (!session) {
        goToLogin();
        return;
      }

      // 2) Validate the persisted session against the backend.
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;
        if (disposed) return;

        if (!user) {
          goToLogin();
          return;
        }

        // 3) Resolve the lifecycle state + role from the profiles table.
        if (!user.email_confirmed_at) {
          goToLogin("unverified=1");
          return;
        }
        const { data: profile } = (await supabase
          .from("profiles")
          .select("role, deactivated_at, restricted_at")
          .eq("user_id", user.id)
          .maybeSingle()) as {
          data: { role: string; deactivated_at: string | null; restricted_at: string | null } | null;
        };
        if (disposed) return;

        if (profile?.restricted_at) {
          router.replace("/auth/restricted");
          return;
        }
        if (profile?.deactivated_at) {
          router.replace("/auth/reactivate");
          return;
        }
        const role: Role | null =
          profile?.role === "student" ||
          profile?.role === "teacher" ||
          profile?.role === "admin"
            ? profile.role
            : null;
        if (role) {
          cacheNativeRole(role);
          router.replace(homePathForRole(role));
          return;
        }
        // Authenticated but no usable profile row — same destination the web
        // middleware picks (never silently allow, never auto-create).
        router.replace("/auth/incomplete");
        return;
      } catch (err) {
        // getUser() failed: auth rejection vs. network problem.
        const status = (err as { status?: number } | null)?.status;
        const authRejected =
          typeof status === "number" && status >= 400 && status < 500;
        const offline =
          typeof navigator !== "undefined" && navigator.onLine === false;

        if (authRejected) {
          // Expired/invalid stored session: clear it safely and show Login.
          try {
            await supabase.auth.signOut();
          } catch {
            /* clearing the local session below still applies */
          }
          goToLogin();
          return;
        }

        if (offline) {
          // 4) Offline cold start with a persisted session: keep the session,
          //    route on the last known role so the local UI opens. Never log
          //    the user out just because the network is down.
          const role = cachedNativeRole();
          if (role) {
            router.replace(homePathForRole(role));
            return;
          }
          goToLogin();
          return;
        }
        // Transient backend failure while "online": drop to the Login screen
        // without destroying the session (AppShell's guard re-checks later).
        goToLogin();
        return;
      }
    }

    void boot();

    // If the session dies while the gate is mounted (remote sign-out, refresh
    // hard-fail elsewhere), fall back to the Login screen.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !disposed) goToLogin();
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [router]);

  // Boot state only: once session resolution finishes the gate has already
  // navigated away (login or role home), so this component only ever renders
  // the minimal logo + spinner.
  return <NativeEntry />;
}
