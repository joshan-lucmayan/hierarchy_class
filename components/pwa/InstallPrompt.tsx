"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already in standalone (installed) — don't show prompt
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
    } else {
      setDismissed(true);
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-[10px] border border-gold-soft bg-surface p-4 shadow-xl supports-[bottom:env(safe-area-inset-bottom)]:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:left-auto md:right-4 md:bottom-4 md:w-auto">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy">Install Hierarchy Class</p>
        <p className="text-xs text-muted">Add to your home screen for quick access.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-full border border-base px-3 py-1.5 text-xs font-semibold text-muted hover:border-gold"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          Install
        </button>
      </div>
    </div>
  );
}
