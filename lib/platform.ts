/**
 * Platform / install-context detection for the download experience.
 *
 * Design rules:
 * - Pure and injectable: `detectPlatform` takes explicit signals so it is
 *   SSR-safe and unit-testable. The React hook (`usePlatformContext`)
 *   collects the signals AFTER mount, so server HTML never depends on them.
 * - Capability/display-mode first; user-agent only as a fallback hint.
 *
 * TWA limitation (documented honestly): a Trusted Web Activity is not
 * directly identifiable from web JS. The strongest reliable signal is that a
 * TWA launch sets document.referrer to "android-app://<package>". We combine
 * that with standalone-style display modes to derive an `installedLike`
 * context. If both signals are absent we assume a normal browser.
 */

export const ANDROID_APP_PACKAGE = "com.hierarchyclass.app";

export interface PlatformSignals {
  /** navigator.userAgent (fallback hint only). */
  userAgent?: string | null;
  /** navigator.platform or userAgentData.platform. */
  platformHint?: string | null;
  /** navigator.maxTouchPoints. */
  maxTouchPoints?: number;
  /** Any of display-mode: standalone / fullscreen / minimal-ui matched. */
  displayModeAppLike?: boolean;
  /** navigator.standalone (iOS Safari home-screen apps). */
  iosStandalone?: boolean;
  /** document.referrer (TWA launches set android-app://<package>). */
  referrer?: string | null;
}

export interface PlatformContext {
  /** Running inside any installed/app-like surface (PWA standalone, TWA). */
  installedLike: boolean;
  /** Display mode is standalone/fullscreen/minimal-ui (or iOS equivalent). */
  isStandalone: boolean;
  /**
   * Launched from our Android package (strongest available TWA signal).
   * NOTE: false does not prove "not TWA" - see module doc.
   */
  isTWAReferrer: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isDesktop: boolean;
}

function isIOSUA(ua: string, platformHint: string | null, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ masquerades as desktop Safari.
  return /Macintosh/i.test(ua) && maxTouchPoints > 1 && !/Windows/i.test(platformHint ?? "");
}

export function detectPlatform(signals: PlatformSignals): PlatformContext {
  const ua = signals.userAgent ?? "";
  const platformHint = signals.platformHint ?? null;
  const maxTouchPoints = signals.maxTouchPoints ?? 0;

  const isAndroid = /Android/i.test(ua);
  const isIOS = isIOSUA(ua, platformHint, maxTouchPoints);

  const isStandalone =
    signals.displayModeAppLike === true || signals.iosStandalone === true;

  const referrer = signals.referrer ?? "";
  const isTWAReferrer = referrer.startsWith(`android-app://${ANDROID_APP_PACKAGE}`);

  // An Android TWA reports app-like display modes in practice; treat either
  // signal as "already has the app".
  const installedLike = isStandalone || isTWAReferrer;

  const isDesktop = !isAndroid && !isIOS && !/Mobile|Tablet/i.test(ua);

  return { installedLike, isStandalone, isTWAReferrer, isAndroid, isIOS, isDesktop };
}
