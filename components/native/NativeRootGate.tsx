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
 * NativeEntry HTML, and this client gate owns the cold-start auth decision —
 * the exact equivalent of the web's app/page.tsx redirect + middleware rules
 * (lib/authz.ts decideAuthRoute), so both platforms follow one flow:
 *
 *   1. getSession()            — local, no network. No session → entry screen
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
 *                                and the entry screen is shown.
 *
 * While resolving, the gate shows the entry screen's boot state (logo +
 * spinner). Protected routes are never rendered before the session is
 * determined — AppShell's useNativeAuthGuard re-checks on the role sections.
 *
 * Hydration: the FIRST client render is `showActions=false`, which is exactly
 * the static export HTML of "/" — no mismatch, no landing flash. Every state
 * change happens after mount.
 *
 * Rendered by app/page.tsx ONLY in the Android export build (CAPACITOR_EXPORT
 * =1); the web deployment never mounts it.
 */
export function NativeRootGate() {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);

  // While the entry state is up (no valid session) the gate IS the app root:
  // hardware back exits the app. This keeps any stale authenticated entries
  // that may still sit behind "/" after a sign-out unreachable — back can
  // never re-enter an authed page and bounce to /login. Unregisters as soon
  // as the gate unmounts (the entry actions navigate away client-side via
  // Next <Link>, pushing /login or /signup onto the stack).
  useEffect(() => {
    if (!showActions) return;
    return registerBackHandler(() => {
      void App.exitApp();
      return true;
    });
  }, [showActions]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let disposed = false;
    const supabase = createClient();

    function finishAtEntry() {
      if (disposed) return;
      clearNativeRole();
      setShowActions(true);
    }

    async function boot() {
      // Cold-start auth deep link (password recovery / confirmation): the
      // NativeDeepLink handler (root layout) owns the exchange and will
      // navigate away (unmounting this gate). Stay in the boot state instead
      // of showing the entry screen or routing to a role home.
      if (hasPendingAuthLink()) return;

      // 1) Local session check (no network): fast path for signed-out users.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (!session) {
        setShowActions(true);
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
          finishAtEntry();
          return;
        }

        // 3) Resolve the lifecycle state + role from the profiles table.
        if (!user.email_confirmed_at) {
          router.replace("/login?unverified=1");
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
          // Expired/invalid stored session: clear it safely and show entry.
          try {
            await supabase.auth.signOut();
          } catch {
            /* clearing the local session below still applies */
          }
          finishAtEntry();
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
          setShowActions(true);
          return;
        }
        // Transient backend failure while "online": drop to the entry screen
        // without destroying the session (AppShell's guard re-checks later).
      }
      if (!disposed) setShowActions(true);
    }

    void boot();

    // If the session dies while the gate is mounted (remote sign-out, refresh
    // hard-fail elsewhere), fall back to the entry screen.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !disposed) finishAtEntry();
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [router]);

  return <NativeEntry showActions={showActions} />;
}
