/**
 * Pure, testable core of the global app-update system.
 *
 * Build identity: NEXT_PUBLIC_APP_VERSION (inlined by next.config.js from
 * VERCEL_GIT_COMMIT_SHA on Vercel, falling back to package.json version).
 *
 * Storage keys are namespaced PER BUILD so dismissing one update never hides
 * the next one, and reload guards are scoped to the exact build being applied.
 */

export const DISMISSED_PREFIX = "hc-update-dismissed:";
export const APPLIED_PREFIX = "hc-update-applied:";
export const UPDATING_PREFIX = "hc-updating:";

export function normalizeBuild(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function dismissedKey(build: string): string {
  return DISMISSED_PREFIX + build;
}

export function appliedKey(build: string): string {
  return APPLIED_PREFIX + build;
}

export function updatingKey(build: string): string {
  return UPDATING_PREFIX + build;
}

/** Minimal synchronous storage contract so tests can inject fakes. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UpdateDecisionInput {
  /** Build reported by /api/version (or null if unreachable). */
  remoteBuild: string | null;
  /** Build this client was built with. */
  currentBuild: string | null;
  /** A service worker is installed-but-waiting to take control. */
  waitingWorker: boolean;
  /** True when the page is currently controlled by a service worker (i.e. not first install). */
  hasController: boolean;
  /** Persistent store (localStorage) — remembers per-build dismissals. */
  dismissalStore: KeyValueStore;
  /** Session-scoped store (sessionStorage) — reload-loop guards. */
  guardStore: KeyValueStore;
}

export interface UpdateDecision {
  show: boolean;
  reason:
    | "no-change"
    | "waiting-worker"
    | "new-build"
    | "dismissed-for-this-version"
    | "already-applied-this-session"
    | "missing-build-info";
}

/**
 * Decide whether the global update prompt should be visible right now.
 * - A waiting service worker always counts as an available update (the browser
 *   only installs a new worker when /sw.js changed).
 * - Otherwise a remote build different from ours means a new deployment shipped.
 * - Dismissal is remembered PER detected build; a later build prompts again.
 * - If we already applied an update for this build this session, stay quiet
 *   (prevents loops when the version endpoint briefly lags behind the deploy).
 */
export function decideUpdate(input: UpdateDecisionInput): UpdateDecision {
  const { remoteBuild, currentBuild, waitingWorker, hasController, dismissalStore, guardStore } =
    input;

  if (waitingWorker && hasController) {
    // The waiting worker's own identity isn't directly readable here, but a
    // waiting worker only exists because a new deploy changed sw.js — treat it
    // as its own version signal and ignore stale dismissals from older builds.
    return { show: true, reason: "waiting-worker" };
  }

  const remote = normalizeBuild(remoteBuild);
  const current = normalizeBuild(currentBuild);
  if (!remote || !current || remote === current) {
    return { show: false, reason: "no-change" };
  }

  if (guardStore.getItem(appliedKey(current))) {
    // We already reloaded for this deploy within this session. Stay quiet so
    // a lagging /api/version response can never cause a reload loop.
    return { show: false, reason: "already-applied-this-session" };
  }

  if (dismissalStore.getItem(dismissedKey(remote))) {
    return { show: false, reason: "dismissed-for-this-version" };
  }

  return { show: true, reason: "new-build" };
}

/**
 * Called by the Update button BEFORE any reload happens. Marks the update as
 * intentionally requested so the controllerchange listener knows this reload
 * is user-approved, and records the applied-from build so we never loop.
 */
export function markIntentionalUpdate(build: string | null, store: KeyValueStore): void {
  if (normalizeBuild(build)) {
    store.setItem(appliedKey(build as string), String(Date.now()));
    store.setItem(updatingKey(build as string), String(Date.now()));
  }
}

/**
 * Should the controllerchange handler reload? Only when the user explicitly
 * requested an update (updating flag present). Consumes the updating flag so
 * one click can cause exactly one reload.
 */
export function consumeUpdatingFlag(build: string | null, store: KeyValueStore): boolean {
  const key = normalizeBuild(build) ? updatingKey(build as string) : null;
  if (!key) return false;
  const value = store.getItem(key);
  if (value !== null) {
    store.removeItem(key);
    return true;
  }
  return false;
}
