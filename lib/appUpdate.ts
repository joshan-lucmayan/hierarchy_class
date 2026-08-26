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
 * - A waiting service worker counts as an available update (the browser only
 *   installs a new worker when /sw.js changed).
 * - Otherwise a remote build different from ours means a new deployment shipped.
 * - Dismissal is remembered PER detected build (or under the stable "sw"
 *   identity for pure service-worker signals); a later build prompts again.
 * - If we already applied an update involving either side of this comparison
 *   within this session, stay quiet (prevents loops when /api/version lags a
 *   deploy in either direction).
 */
export function decideUpdate(input: UpdateDecisionInput): UpdateDecision {
  const { remoteBuild, currentBuild, waitingWorker, hasController, dismissalStore, guardStore } =
    input;

  const current = normalizeBuild(currentBuild);
  if (!current) {
    return { show: false, reason: "missing-build-info" };
  }

  const remote = normalizeBuild(remoteBuild);

  // Deployment matches us (or no usable remote info yet) → quiet. This also
  // covers first install: fresh HTML always matches its own deployment.
  if (remote !== null && remote === current) {
    return { show: false, reason: "no-change" };
  }

  // Stable identity for pure-SW signals where /api/version hasn't answered yet.
  const dismissalId = remote ?? "sw";

  // Reload-loop guard: stay quiet if this session already applied an update
  // involving either the build we came from OR the build being reported.
  // (Protects against a lagging endpoint flip-flopping in either direction.)
  if (
    guardStore.getItem(appliedKey(current)) ||
    (remote !== null && guardStore.getItem(appliedKey(remote)))
  ) {
    return { show: false, reason: "already-applied-this-session" };
  }

  // Per-build dismissal applies to both signal types.
  if (dismissalStore.getItem(dismissedKey(dismissalId))) {
    return { show: false, reason: "dismissed-for-this-version" };
  }

  if (waitingWorker && hasController) {
    return { show: true, reason: "waiting-worker" };
  }

  // Version-only path requires a usable remote build to prompt against.
  if (!remote) {
    return { show: false, reason: "missing-build-info" };
  }

  return { show: true, reason: "new-build" };
}

/**
 * Called by the Update button BEFORE any reload happens.
 * - updatingKey(currentBuild): consumed by controllerchange → one reload.
 * - appliedKey(currentBuild): hides further prompting for this session even
 *   if the reload lands mid-deploy.
 * - appliedKey(detectedRemoteBuild): pins the build we were PROMPTED from, so
 *   a lagging endpoint serving that same old build right after the reload
 *   cannot re-trigger the prompt (no flip-flop loops).
 */
export function markIntentionalUpdate(
  currentBuild: string | null,
  detectedRemoteBuild: string | null,
  store: KeyValueStore
): void {
  const cur = normalizeBuild(currentBuild);
  const rem = normalizeBuild(detectedRemoteBuild);
  const now = String(Date.now());
  if (cur) {
    store.setItem(appliedKey(cur), now);
    store.setItem(updatingKey(cur), now);
  }
  if (rem && rem !== cur) {
    store.setItem(appliedKey(rem), now);
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
