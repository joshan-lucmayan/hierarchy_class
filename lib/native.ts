import { Capacitor } from "@capacitor/core";
import type { KeyboardEvent } from "react";
import type { Role } from "@/types/supabase";

/**
 * Native-style keyboard advancement for the Android auth forms.
 *
 * On Android the software keyboard's action key ("Next") is wired through
 * `enterKeyHint`; React does not auto-advance focus between fields, so a
 * tap on "Next" would submit the whole form early. This helper moves focus
 * to the next input instead (mimicking a native form). Used ONLY by the
 * standalone Android auth screens; the web deployment never mounts those.
 */
export function advanceNativeInput(
  e: KeyboardEvent<HTMLInputElement>,
  nextId: string
): void {
  if (e.key !== "Enter") return;
  e.preventDefault();
  document.getElementById(nextId)?.focus();
}

/**
 * True only when this frontend bundle is running inside the native
 * Capacitor Android app (loaded from the APK's bundled assets).
 *
 * In a normal browser / PWA / TWA this returns false, so every guard built
 * on it is a no-op for the web deployment. Capacitor core is isomorphic:
 * on the web it is a tiny inert module.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Last-known profile role for the native app, written after login and after
 * every successful boot-time role resolution. It exists ONLY for the offline
 * cold-start path: when the device has a persisted Supabase session but no
 * network, the boot gate still routes to the right role home instead of
 * dead-ending, while the role pages surface their own offline errors.
 * It is a convenience hint (never an auth signal) and is cleared whenever the
 * session is found invalid or signed out.
 */
const NATIVE_ROLE_KEY = "hc-native-role";

function isRole(value: unknown): value is Role {
  return value === "student" || value === "teacher" || value === "admin";
}

export function cacheNativeRole(role: Role): void {
  if (!isNativeApp()) return;
  try {
    window.localStorage.setItem(NATIVE_ROLE_KEY, role);
  } catch {
    /* storage unavailable - offline boot just falls back to the entry screen */
  }
}

export function cachedNativeRole(): Role | null {
  try {
    const role = window.localStorage.getItem(NATIVE_ROLE_KEY);
    return isRole(role) ? role : null;
  } catch {
    return null;
  }
}

export function clearNativeRole(): void {
  try {
    window.localStorage.removeItem(NATIVE_ROLE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Cold-start deep-link coordination between NativeDeepLink and
 * NativeRootGate.
 *
 * On a cold start opened by a Supabase auth email link, BOTH components
 * query App.getLaunchUrl().  NativeRootGate must not show the entry screen
 * (or route to a role home) while NativeDeepLink is exchanging the recovery
 * code, otherwise there'd be an entry flash or a wrong-route hop.  When a
 * recovery/confirmation code is present the deep-link handler records it
 * here; the gate checks the flag at boot and, if set, stays in its boot
 * state until the handler exchanges the code and navigates away (which
 * unmounts the gate).
 */
let pendingAuthLink: { code: string; type: string | null } | null = null;

export function setPendingAuthLink(code: string, type: string | null): void {
  pendingAuthLink = { code, type };
}

export function consumePendingAuthLink(): { code: string; type: string | null } | null {
  const value = pendingAuthLink;
  pendingAuthLink = null;
  return value;
}

export function hasPendingAuthLink(): boolean {
  return pendingAuthLink !== null;
}
