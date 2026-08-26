"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  consumeUpdatingFlag,
  decideUpdate,
  dismissedKey,
  markIntentionalUpdate,
  normalizeBuild,
} from "@/lib/appUpdate";
import { AppUpdatePrompt } from "@/components/pwa/AppUpdatePrompt";

/**
 * Global app-update orchestrator (mounted once in the root layout).
 *
 * Detection — two independent signals:
 *   1. Service worker: a new /sw.js installs a waiting worker → update exists.
 *      Activation stays consent-gated (sw.js only skips waiting on our message).
 *   2. Version endpoint: GET /api/version returns the deployment build
 *      (Vercel commit SHA). Compared against the build inlined into this page.
 *      Checked on mount, when the tab regains focus/visibility, and every
 *      15 minutes while visible.
 *
 * Reload safety:
 *   - Update click sets per-build "applied"/"updating" flags BEFORE reloading.
 *   - controllerchange reloads ONLY when the updating flag is present, and the
 *     flag is consumed so one click = exactly one reload.
 *   - The applied flag suppresses re-prompting within the same session for the
 *     build we left, preventing loops if /api/version briefly lags a deploy.
 *
 * Dismissal ("Later") is remembered PER detected build in localStorage — a
 * newer deployment always prompts again.
 */

const VERSION_CHECK_INTERVAL_MS = 15 * 60 * 1000;

// localStorage/sessionStorage may throw (private mode, disabled) — never let
// update plumbing break the app over storage access.
const safeLocal: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const safeSession: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: (k) => {
    try {
      return window.sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      window.sessionStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      window.sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export function ServiceWorkerRegistration() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offlineNote, setOfflineNote] = useState(false);

  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const remoteBuildRef = useRef<string | null>(null);
  // The build this page was built with; stable for the lifetime of the tab.
  const currentBuild = normalizeBuild(process.env.NEXT_PUBLIC_APP_VERSION) ?? "dev";

  const evaluate = useCallback(
    (remoteBuild: string | null, waitingWorker: boolean, hasController: boolean) => {
      const decision = decideUpdate({
        remoteBuild,
        currentBuild,
        waitingWorker,
        hasController,
        dismissalStore: safeLocal,
        guardStore: safeSession,
      });
      if (decision.show) {
        remoteBuildRef.current = remoteBuild;
        setOpen(true);
      }
    },
    [currentBuild]
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Only register in secure contexts (HTTPS or localhost)
    if (!window.isSecureContext) return;

    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;

    const hasController = !!navigator.serviceWorker.controller;
    const checkWaitingWorker = () => {
      const reg = registration;
      if (!reg) return false;
      if (reg.waiting && hasController) {
        waitingWorkerRef.current = reg.waiting;
        return true;
      }
      return false;
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (disposed) return;
        registration = reg;

        if (checkWaitingWorker()) {
          evaluate(remoteBuildRef.current, true, hasController);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // New worker downloaded but old one still controls the page.
              waitingWorkerRef.current = installing;
              evaluate(remoteBuildRef.current, true, hasController);
            }
          });
        });
      })
      .catch(() => {
        // Registration failed — silently ignore (offline, insecure dev, etc.)
      });

    // --- Version endpoint checks -------------------------------------------
    const runVersionCheck = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data: unknown = await res.json();
        const build = normalizeBuild(
          (data as { build?: unknown } | null)?.build
        );
        if (build === null) return;
        remoteBuildRef.current = build;
        if (build === currentBuild) {
          // We are up to date — clear any transient pure-SW dismissal so a
          // FUTURE waiting worker can prompt again (stale-key sweep).
          safeLocal.removeItem(dismissedKey("sw"));
        }
        evaluate(build, checkWaitingWorker(), !!navigator.serviceWorker.controller);
      } catch {
        // Offline or endpoint unavailable — SW detection still covers updates.
      }
    };

    void runVersionCheck();

    const onVisible = () => {
      if (document.visibilityState === "visible") void runVersionCheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void runVersionCheck();
    }, VERSION_CHECK_INTERVAL_MS);

    // --- Consent-gated activation ------------------------------------------
    const onControllerChange = () => {
      // Reload exactly once, only when the user clicked Update.
      if (consumeUpdatingFlag(currentBuild, safeSession)) {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [currentBuild, evaluate]);

  function handleUpdate() {
    if (busy) return;
    // Offline: never start an update sequence we cannot complete, and never
    // leave the button stuck claiming an update is in progress.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOfflineNote(true);
      return;
    }
    setBusy(true);
    markIntentionalUpdate(currentBuild, remoteBuildRef.current, safeSession);
    const waiting = waitingWorkerRef.current;
    if (waiting) {
      // New worker activates via SKIP_WAITING → controllerchange fires →
      // flag consumed → single reload.
      waiting.postMessage({ type: "SKIP_WAITING" });
      // Fallback: some engines deliver controllerchange before our listener
      // runs on bfcache restores; force at most one delayed reload if the
      // controller changed but no reload happened yet.
      window.setTimeout(() => {
        if (consumeUpdatingFlag(currentBuild, safeSession)) {
          window.location.reload();
        }
      }, 3000);
    } else {
      // Version-check-only path: no waiting worker (e.g. HTML-only change).
      // One controlled reload; navigate requests are NetworkFirst so HTML is
      // always fresh after reload.
      window.location.reload();
    }
  }

  function handleDismiss() {
    setOpen(false);
    // Remember dismissal FOR THIS DETECTED BUILD only — a newer deployment
    // prompts again. Pure-SW signals (remote unknown yet) dismiss under the
    // stable "sw" identity; that key is swept once /api/version confirms we
    // are up to date, so it never blocks future updates.
    const id = normalizeBuild(remoteBuildRef.current) ?? "sw";
    safeLocal.setItem(dismissedKey(id), String(Date.now()));
  }

  return (
    <AppUpdatePrompt
      open={open}
      busy={busy}
      note={offlineNote ? "You're offline — reconnect to update." : undefined}
      onUpdate={handleUpdate}
      onDismiss={() => {
        setOfflineNote(false);
        handleDismiss();
      }}
    />
  );
}
