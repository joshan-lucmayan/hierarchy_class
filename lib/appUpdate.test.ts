import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appliedKey,
  consumeUpdatingFlag,
  decideUpdate,
  dismissedKey,
  updatingKey,
  markIntentionalUpdate,
  normalizeBuild,
  type KeyValueStore,
} from "./appUpdate.ts";

function memStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const BASE = {
  remoteBuild: "v1",
  currentBuild: "v1",
  waitingWorker: false,
  hasController: true,
  dismissalStore: memStore(),
  guardStore: memStore(),
};

test("no update available → notification hidden", () => {
  const d = decideUpdate(BASE);
  assert.equal(d.show, false);
  assert.equal(d.reason, "no-change");
});

test("waiting service worker → notification appears", () => {
  // Pure-SW signal: /api/version hasn't reported yet (remote null).
  const d = decideUpdate({ ...BASE, remoteBuild: null, waitingWorker: true });
  assert.equal(d.show, true);
  assert.equal(d.reason, "waiting-worker");
});

test("waiting worker with endpoint agreeing up-to-date stays quiet until it catches up", () => {
  const d = decideUpdate({ ...BASE, waitingWorker: true });
  assert.equal(d.show, false);
  assert.equal(d.reason, "no-change");
});

test("new deployment build → notification appears", () => {
  const d = decideUpdate({ ...BASE, remoteBuild: "abc123" });
  assert.equal(d.show, true);
  assert.equal(d.reason, "new-build");
});

test("dismiss update → hidden for that specific version", () => {
  const dismissalStore = memStore();
  dismissalStore.setItem(dismissedKey("abc123"), String(Date.now()));
  const d = decideUpdate({ ...BASE, remoteBuild: "abc123", dismissalStore });
  assert.equal(d.show, false);
  assert.equal(d.reason, "dismissed-for-this-version");
});

test("a later different version → notification appears again after dismissing the old one", () => {
  const dismissalStore = memStore();
  dismissalStore.setItem(dismissedKey("build-a"), String(Date.now()));
  const d = decideUpdate({
    ...BASE,
    remoteBuild: "build-b",
    dismissalStore,
  });
  assert.equal(d.show, true);
  assert.equal(d.reason, "new-build");
});

test("clicking Update triggers exactly one activation/reload sequence", () => {
  const guardStore = memStore();
  // First click sets the flag; controllerchange consumes it → reload once.
  assert.equal(consumeUpdatingFlag("v1", guardStore), false);
  markIntentionalUpdate("v1", null, guardStore);
  assert.equal(consumeUpdatingFlag("v1", guardStore), true);
  // Flag consumed → second controllerchange must NOT reload again.
  assert.equal(consumeUpdatingFlag("v1", guardStore), false);
});

test("reload guard prevents infinite loops when /api/version lags a deploy", () => {
  const guardStore = memStore();
  markIntentionalUpdate("old-build", null, guardStore);
  const d = decideUpdate({
    ...BASE,
    currentBuild: "old-build",
    remoteBuild: "new-build", // endpoint briefly still reports the new deploy
    guardStore,
  });
  assert.equal(d.show, false);
  assert.equal(d.reason, "already-applied-this-session");
});

test("first install (no controller yet) with waiting worker does not prompt as update", () => {
  const d = decideUpdate({ ...BASE, waitingWorker: true, hasController: false });
  // A brand-new visitor has nothing to update FROM.
  assert.equal(d.show, false);
  assert.equal(d.reason, "no-change");
});


test("waiting-worker update respects per-version dismissal (no re-prompt loop)", () => {
  const dismissalStore = memStore();
  // Remote known: dismissal keyed by the detected build.
  dismissalStore.setItem(dismissedKey("abc123"), String(Date.now()));
  let d = decideUpdate({
    ...BASE,
    remoteBuild: "abc123",
    waitingWorker: true,
    dismissalStore,
  });
  assert.equal(d.show, false);
  assert.equal(d.reason, "dismissed-for-this-version");

  // Pure-SW signal (remote unknown): dismissed under the stable "sw" identity.
  const ds2 = memStore();
  ds2.setItem(dismissedKey("sw"), String(Date.now()));
  d = decideUpdate({ ...BASE, remoteBuild: null, waitingWorker: true, dismissalStore: ds2 });
  assert.equal(d.show, false);
});

test("a later deployment after dismissing a waiting-worker update prompts again", () => {
  const dismissalStore = memStore();
  dismissalStore.setItem(dismissedKey("abc123"), String(Date.now()));
  const d = decideUpdate({
    ...BASE,
    remoteBuild: "def456",
    waitingWorker: true,
    dismissalStore,
  });
  assert.equal(d.show, true);
});

test("stale server reporting the PREVIOUS build after an applied reload cannot re-prompt", () => {
  const guardStore = memStore();
  // User updated from build-a; endpoint briefly still reports build-a.
  markIntentionalUpdate("build-b", "build-a", guardStore);
  const d = decideUpdate({
    ...BASE,
    currentBuild: "build-b",
    remoteBuild: "build-a",
    guardStore,
  });
  assert.equal(d.show, false);
  assert.equal(d.reason, "already-applied-this-session");
});

test("markIntentionalUpdate pins BOTH the current and the detected remote build", () => {
  const guardStore = memStore();
  markIntentionalUpdate("cur", "rem", guardStore);
  assert.ok(guardStore.getItem(appliedKey("cur")));
  assert.ok(guardStore.getItem(appliedKey("rem")));
  assert.ok(guardStore.getItem(updatingKey("cur")));
});

test("missing/unusable build info never prompts", () => {
  assert.equal(decideUpdate({ ...BASE, remoteBuild: null }).show, false);
  assert.equal(decideUpdate({ ...BASE, remoteBuild: "   " }).show, false);
  assert.equal(decideUpdate({ ...BASE, currentBuild: null }).show, false);
  assert.equal(normalizeBuild(123 as unknown), null);
});
