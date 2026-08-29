"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp, setPendingAuthLink } from "@/lib/native";

/**
 * Handles Android App Links / Universal Links that open the app from a
 * Supabase auth email (password-recovery or signup-confirmation).
 *
 * The email link points to the deployed backend's /auth/callback route:
 *   https://www.hierarchyclass.com/auth/callback?type=recovery&code=...
 *
 * When the device has App Link verification (via assetlinks.json, which
 * already lists both debug and release certificates), tapping the link
 * opens this app directly. This component exchanges the recovery code
 * client-side (the same way the web backend does server-side) and routes
 * to the appropriate page.
 *
 * If App Link verification hasn't completed, the link opens in the
 * system browser and the existing web recovery flow runs — the app
 * never sees the URL.  Both paths are functional; the deep link is an
 * enhancement, not a critical dependency.
 *
 * Mounted once from the root layout (next to NativeBackButton).  Only
 * active in the Capacitor Android build (isNativeApp guard); the web
 * build is a no-op.
 */
export function NativeDeepLink() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;

    let disposed = false;
    // Prevent processing the same URL twice (both getLaunchUrl and
    // appUrlOpen may fire for the same cold-start intent).
    const processed = new Set<string>();

    async function handleUrl(url: string) {
      if (disposed || !url) return;
      if (processed.has(url)) return;
      processed.add(url);
      try {
        const parsed = new URL(url);
        // Only handle the auth callback path
        if (!parsed.pathname.startsWith("/auth/callback")) return;

        const code = parsed.searchParams.get("code");
        const type = parsed.searchParams.get("type");
        if (!code) return;

        // Record the pending link so NativeRootGate defers to us.
        setPendingAuthLink(code, type);

        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (disposed) return;

        if (error) {
          if (type === "recovery") {
            router.replace("/reset-password?invalid=1");
          } else {
            router.replace("/login?confirmed=0");
          }
          return;
        }

        // Code exchanged successfully — session is now valid.
        if (type === "recovery") {
          router.replace("/reset-password");
        } else {
          router.replace("/login?confirmed=1");
        }
      } catch {
        // ignore malformed URLs
      }
    }

    // Listen for appUrlOpen events (warm launch / already running).
    let removeListener: (() => void) | undefined;
    App.addListener("appUrlOpen", (event) => {
      void handleUrl(event.url);
    }).then((registered) => {
      if (disposed) {
        void registered.remove();
      } else {
        removeListener = registered.remove;
      }
    });

    // Also check the initial launch URL (cold start via deep link).
    void App.getLaunchUrl().then((res) => {
      if (res?.url) void handleUrl(res.url);
    });

    return () => {
      disposed = true;
      if (removeListener) removeListener();
    };
  }, [router]);

  return null;
}