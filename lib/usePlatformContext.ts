"use client";

import { useEffect, useState } from "react";
import {
  detectPlatform,
  type PlatformContext,
} from "@/lib/platform";

/**
 * Hydration-safe platform/install-context detection.
 *
 * Server render and the first client render return `ready: false` with a
 * neutral context (installedLike: true) so install CTAs stay hidden until we
 * can prove a normal-browser context - installed users must never see a flash
 * of install UI, and unknown contexts err on the side of hiding it.
 *
 * Collects signals only after mount:
 * - display-mode media queries (standalone / fullscreen / minimal-ui)
 * - navigator.standalone (iOS)
 * - document.referrer (android-app:// TWA launches)
 * - userAgent / platform hints (fallback only)
 */
export function usePlatformContext(): PlatformContext & { ready: boolean } {
  const [state, setState] = useState<PlatformContext & { ready: boolean }>({
    ready: false,
    installedLike: true,
    isStandalone: false,
    isTWAReferrer: false,
    isAndroid: false,
    isIOS: false,
    isDesktop: false,
  });

  useEffect(() => {
    const mqStandalone = window.matchMedia("(display-mode: standalone)");
    const mqFullscreen = window.matchMedia("(display-mode: fullscreen)");
    const mqMinimalUi = window.matchMedia("(display-mode: minimal-ui)");

    const read = () => {
      setState({
        ready: true,
        ...detectPlatform({
          userAgent: window.navigator.userAgent,
          platformHint:
            (window.navigator as Navigator & { userAgentData?: { platform?: string } })
              .userAgentData?.platform ?? window.navigator.platform,
          maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
          displayModeAppLike:
            mqStandalone.matches || mqFullscreen.matches || mqMinimalUi.matches,
          iosStandalone:
            "standalone" in window.navigator &&
            Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone),
          referrer: document.referrer,
        }),
      });
    };

    read();
    // Display mode can change right after install; re-check briefly.
    const mqs = [mqStandalone, mqFullscreen, mqMinimalUi];
    mqs.forEach((mq) => mq.addEventListener("change", read));
    return () => mqs.forEach((mq) => mq.removeEventListener("change", read));
  }, []);

  return state;
}
