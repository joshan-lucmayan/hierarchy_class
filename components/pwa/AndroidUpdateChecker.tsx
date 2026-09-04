"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";
import { PRODUCTION_ORIGIN } from "@/lib/siteUrl";
import { APP_VERSION } from "@/lib/version";

/**
 * Check for newer Android APK versions.
 *
 * Fetches the release metadata from the production domain and compares the
 * installed version against the latest using proper numeric MAJOR/MINOR/BUG_FIX
 * comparison (never lexicographic - 1.10.0 must beat 1.9.0). The project
 * versionCode convention is MAJOR×100000 + MINOR×1000 + BUG_FIX (1.23.110 →
 * 123110); the metadata's versionCode is compared too as a secondary guard.
 * If a newer version is available, a non-blocking banner directs the user to
 * the official download page. Does NOT silently install - the user must
 * manually download and install the APK.
 *
 * Gracefully handles:
 * - offline (no fetch → quiet)
 * - metadata unavailable (parse error → quiet)
 * - same version (quiet)
 * - newer version (banner)
 * - forced/minimum version (not implemented - banner still shows)
 */

interface AndroidVersionMeta {
  latestVersion: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  minimumSupportedVersion: string;
  minimumVersionCode: number;
}

/** [major, minor, bugFix] from a MAJOR.MINOR.BUG_FIX string, or null. */
function parseVersion(v: string): [number, number, number] | null {
  const parts = v.trim().split(".").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

/**
 * Numeric three-part comparison. Returns 1 when a > b, -1 when a < b, 0 when
 * equal. Compares MAJOR first, then MINOR, then BUG_FIX numerically - so
 * 1.10.0 > 1.9.0 correctly.
 */
function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a.localeCompare(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

/** Project convention: MAJOR×100000 + MINOR×1000 + BUG_FIX. */
function versionToCode(v: string): number {
  const p = parseVersion(v);
  return p ? p[0] * 100000 + p[1] * 1000 + p[2] : 0;
}

/**
 * Dismissal persists per remote version in localStorage so "Dismiss" survives
 * cold starts - the banner would otherwise reappear on every launch while a
 * stale install is still in use. A newer latestVersion prompts again.
 */
const DISMISSED_KEY = "hc-android-update-dismissed";

function readDismissedFor(latestVersion: string): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === latestVersion;
  } catch {
    return false;
  }
}

function rememberDismissedFor(latestVersion: string): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, latestVersion);
  } catch {
    /* storage unavailable - dismissal just stays session-scoped */
  }
}

export function AndroidUpdateChecker() {
  const [meta, setMeta] = useState<AndroidVersionMeta | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${PRODUCTION_ORIGIN}/android-version.json`, {
          cache: "no-cache",
        });
        if (!res.ok) return;
        const data: AndroidVersionMeta = await res.json();
        if (cancelled) return;
        if (readDismissedFor(data.latestVersion)) {
          setDismissed(true);
          return;
        }
        setMeta(data);
      } catch {
        // Offline or metadata unavailable - quiet
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isNativeApp() || dismissed || !meta) return null;

  // The banner must appear ONLY when the remote is strictly newer than the
  // installed app - never when they match (the false-update bug) and never
  // when the remote is older. Numeric string comparison is authoritative;
  // versionCode is compared as a secondary guard.
  const remoteNewer =
    compareVersions(meta.latestVersion, APP_VERSION) > 0 ||
    (compareVersions(meta.latestVersion, APP_VERSION) === 0 &&
      meta.versionCode > versionToCode(APP_VERSION));
  if (!remoteNewer) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-modal-in sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="rounded-[10px] border border-accent-soft bg-surface p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-token">Update available</p>
            <p className="mt-1 text-sm font-semibold text-navy">
              Hierarchy Class v{meta.latestVersion}
            </p>
            <p className="mt-0.5 text-xs text-muted">{meta.releaseNotes}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              rememberDismissedFor(meta.latestVersion);
              setDismissed(true);
            }}
            aria-label="Dismiss"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base text-muted transition hover:border-accent-soft hover:text-navy"
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