"use client";

import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { isNativeApp } from "@/lib/native";
import { consumeNativeBack } from "@/lib/nativeBackHandler";

/**
 * THE single Android hardware/system back-button listener for the app.
 *
 * Mounted once from the root layout. There was no other backButton listener
 * in the codebase before this (audited) — overlays like MobileDrawer already
 * participate via history.pushState, and everything using Modal/SearchOverlay/
 * FlorinPurchaseModal/ProfileModal registers in lib/nativeBackHandler.ts.
 *
 * Order (Android policy):
 *   1. An open overlay consumes the press and closes itself.
 *   2. Otherwise, if the WebView has in-app history → history.back().
 *   3. Otherwise (at the root) → normal Android exit via App.exitApp().
 *
 * Web: never attaches (isNativeApp guard); @capacitor/app's web build is a
 * tiny inert module, so the import is harmless there.
 */
export function NativeBackButton() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let handle: PluginListenerHandle | null = null;
    let cancelled = false;

    App.addListener("backButton", ({ canGoBack }) => {
      // 1) Topmost overlay (modal/sheet/drawer without history entries).
      if (consumeNativeBack()) return;
      // 2) In-app navigation history. The event payload's canGoBack only
      //    counts CROSS-DOCUMENT navigations: on-device (Android WebView,
      //    MIUI) it reported false while Next.js pushState entries existed,
      //    so hardware back would exit the app instead of going back. The
      //    Navigation API (Chromium WebView 102+) exposes the joint session
      //    history including same-document (SPA) entries — use it when
      //    present and fall back to the payload elsewhere.
      const nav = (window as { navigation?: { canGoBack: boolean } }).navigation;
      const hasHistory = nav ? nav.canGoBack : canGoBack;
      if (hasHistory) {
        window.history.back();
        return;
      }
      // 3) Root of the app: standard Android exit.
      void App.exitApp();
    }).then((registered) => {
      if (cancelled) {
        void registered.remove();
      } else {
        handle = registered;
      }
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);

  return null;
}
