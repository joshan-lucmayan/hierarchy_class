"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Only register in secure contexts (HTTPS or localhost)
    if (!window.isSecureContext) return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;

        // Check for waiting worker on load (update already downloaded)
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setUpdateReady(true);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // New content available, but old worker still controls page — ask user to reload
              setWaitingWorker(installing);
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        // Registration failed — silently ignore (offline, not HTTPS in dev, etc.)
      });

    // When user approves update, new worker takes control → reload
    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function handleUpdate() {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  }

  if (!updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-[10px] border border-gold-soft bg-surface p-4 shadow-xl supports-[bottom:env(safe-area-inset-bottom)]:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:left-auto md:right-4 md:w-auto"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy">Update available</p>
        <p className="text-xs text-muted">A new version of Hierarchy Class is ready.</p>
      </div>
      <button
        type="button"
        onClick={handleUpdate}
        className="shrink-0 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      >
        Reload
      </button>
    </div>
  );
}
