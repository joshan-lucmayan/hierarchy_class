import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "./platform.ts";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const BRAVE_ANDROID = CHROME_ANDROID; // Brave shares the Android UA shape
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const SAFARI_IPADOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";

test("Android browser → not installed-like, CTA context allowed", () => {
  const ctx = detectPlatform({ userAgent: CHROME_ANDROID, maxTouchPoints: 5 });
  assert.equal(ctx.isAndroid, true);
  assert.equal(ctx.installedLike, false);
  assert.equal(ctx.isDesktop, false);
});

test("Android TWA → android-app referrer marks installed-like", () => {
  const ctx = detectPlatform({
    userAgent: CHROME_ANDROID,
    displayModeAppLike: true,
    referrer: "android-app://com.hierarchyclass.app",
  });
  assert.equal(ctx.isTWAReferrer, true);
  assert.equal(ctx.isStandalone, true);
  assert.equal(ctx.installedLike, true);
});

test("standalone PWA without TWA referrer is still installed-like", () => {
  const ctx = detectPlatform({ userAgent: CHROME_ANDROID, displayModeAppLike: true });
  assert.equal(ctx.installedLike, true);
  assert.equal(ctx.isTWAReferrer, false);
});

test("iOS Safari browser → iOS detected, not installed-like", () => {
  const ctx = detectPlatform({ userAgent: SAFARI_IOS, maxTouchPoints: 5 });
  assert.equal(ctx.isIOS, true);
  assert.equal(ctx.installedLike, false);
});

test("iOS home-screen web app (navigator.standalone) → installed-like", () => {
  const ctx = detectPlatform({ userAgent: SAFARI_IOS, iosStandalone: true });
  assert.equal(ctx.installedLike, true);
  assert.equal(ctx.isStandalone, true);
});

test("iPadOS masquerading as Macintosh with touch → iOS", () => {
  const ctx = detectPlatform({
    userAgent: SAFARI_IPADOS,
    platformHint: "MacIntel",
    maxTouchPoints: 5,
  });
  assert.equal(ctx.isIOS, true);
});

test("desktop browsers → desktop, browser context", () => {
  for (const ua of [CHROME_DESKTOP, FIREFOX_LINUX]) {
    const ctx = detectPlatform({ userAgent: ua });
    assert.equal(ctx.isDesktop, true);
    assert.equal(ctx.installedLike, false);
  }
});

test("other packages in referrer do NOT count as our TWA", () => {
  const ctx = detectPlatform({
    userAgent: CHROME_ANDROID,
    displayModeAppLike: true,
    referrer: "android-app://com.other.app",
  });
  assert.equal(ctx.isTWAReferrer, false);
  // Still installed-like via display mode.
  assert.equal(ctx.installedLike, true);
});
