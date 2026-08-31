"use client";

import { useCallback, useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";
import { PRODUCTION_ORIGIN } from "@/lib/siteUrl";
import { APP_VERSION } from "@/lib/version";

/**
 * Check for newer Android APK versions.
 *
 * Fetches the release metadata from the production domain and compares the
 * installed versionCode against the latest. If a newer version is available,
 * shows a non-blocking banner directing the user to the official download
 * page. Does NOT silently install — the user must manually download and
 * install the APK.
 *
 * Gracefully handles:
 * - offline (no fetch → quiet)
 * - metadata unavailable (parse error → quiet)
 * - same version (quiet)
 * - newer version (banner)
 * - forced/minimum version (not implemented — banner still shows)
 */

interface AndroidVersionMeta {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  minimumSupportedVersion: string;
  minimumVersionCode: number;
}

export function AndroidUpdateChecker() {
  const [meta, setMeta] = useState<AndroidVersionMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;

    // Parse the current versionCode from the APP_VERSION string (1.23.110 → 123110).
    const parts = APP_VERSION.split(".").map(Number);
    const currentVersionCode = parts.length === 3 ? parts[0] * 10000 + parts[1] * 100 + parts[2] : 0;

    async function check() {
      try {
        const res = await fetch(`${PRODUCTION_ORIGIN}/android-version.json`, {
          cache: "no-cache",
        });
        if (!res.ok) return;
        const data: AndroidVersionMeta = await res.json();
        if (cancelled) return;
        setMeta(data);

        if (data.versionCode > currentVersionCode) {
          // Newer version available — show banner
        }
      } catch {
        // Offline or metadata unavailable — quiet
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isNativeApp() || dismissed || !meta) return null;

  const parts = APP_VERSION.split(".").map(Number);
  const currentVersionCode = parts.length === 3 ? parts[0] * 10000 + parts[1] * 100 + parts[2] : 0;
  if (meta.versionCode <= currentVersionCode) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-modal-in sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="rounded-[10px] border border-gold-soft bg-surface p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-token">Update available</p>
            <p className="mt-1 text-sm font-semibold text-navy">
              Hierarchy Class v{meta.latestVersion}
            </p>
            <p className="mt-0.5 text-xs text-muted">{meta.releaseNotes}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base text-muted transition hover:border-gold-soft hover:text-navy"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <a
          href={meta.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full bg-navy text-sm font-bold uppercase tracking-widest text-white transition hover:opacity-90"
        >
          Download Update
        </a>
        <p className="mt-2 text-[10px] text-center text-faint">
          Installed v{APP_VERSION} · Latest v{meta.latestVersion}
        </p>
      </div>
    </div>
  );
}