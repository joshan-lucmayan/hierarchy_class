"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * SILENT install-prompt capture - renders NOTHING and never calls prompt().
 *
 * Policy: the app must never show unsolicited "Install" UI. Installation will
 * later be offered from dedicated /download pages; those pages can consume the
 * captured event via getDeferredInstallPrompt() (or listen for the
 * `hc-install-available` window event) and call .prompt() explicitly.
 *
 * The event is stored in module scope (one handler, cleaned up on unmount) so
 * there is no listener/memory leak across route changes.
 */

export interface DeferredInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let captured: DeferredInstallPromptEvent | null = null;

/** Consume the captured beforeinstallprompt event, if the browser fired one. */
export function getDeferredInstallPrompt(): DeferredInstallPromptEvent | null {
  return captured;
}

/** Clear the captured event (e.g. after a page used it or it went stale). */
export function clearDeferredInstallPrompt(): void {
  captured = null;
}

export function InstallPromptCapture() {
  useEffect(() => {
    // Standalone Android app: browser install prompts do not apply.
    if (isNativeApp()) return;
    const onBeforeInstall = (e: Event) => {
      // Suppress ALL automatic install prompting - capture for manual use only.
      e.preventDefault();
      captured = e as DeferredInstallPromptEvent;
      window.dispatchEvent(new Event("hc-install-available"));
    };
    const onInstalled = () => {
      captured = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
