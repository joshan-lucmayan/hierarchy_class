"use client";

import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * Scroll-collapsible header state for the standalone Android app.
 *
 * On Android the header collapses to a minimal strip (essential back/menu
 * control only) when the user scrolls DOWN, and returns to the full header
 * when the user scrolls UP. On web/desktop/tablet this hook always reports
 * `false`, so those layouts keep their existing fixed header behavior.
 *
 * Deterministic + flash-free:
 * - One authoritative scroll source (`document.scrollingElement`). In the
 *   Capacitor WebView that is the element that actually scrolls; a window
 *   listener is attached too as a fallback.
 * - Small but clear hysteresis: collapse after scrolling down past the
 *   threshold; only expand again after scrolling back up close to the top.
 *   A single tiny jiggle in either direction never toggles the header.
 * - rAF-throttled with a single listener - no jitter, no duplicate listeners.
 */
const COLLAPSE_AT = 16; // px scrolled down before the header hides
const EXPAND_AT = 4; // px from the top before the header returns

function getScrollTop(): number {
  if (typeof window === "undefined") return 0;
  const se = document.scrollingElement;
  if (se) return se.scrollTop;
  return window.pageYOffset ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0;
}

export function useCollapsibleHeader(): boolean {
  const [compact, setCompact] = useState(false);
  // Track previous state inside the listener so the hook is stable across
  // re-renders (avoids re-subscribing and keeps the scroll math continuous).
  const compactRef = useRef(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    if (!isNativeApp()) return;
    lastYRef.current = getScrollTop();
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = getScrollTop();
        const currentlyCompact = compactRef.current;
        let next = currentlyCompact;
        if (!currentlyCompact && y > COLLAPSE_AT) {
          next = true;
        } else if (currentlyCompact && y < EXPAND_AT) {
          next = false;
        }
        if (next !== currentlyCompact) {
          compactRef.current = next;
          setCompact(next);
        }
        lastYRef.current = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const se = document.scrollingElement || document.documentElement;
    se.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      se.removeEventListener("scroll", onScroll);
    };
  }, []);

  return compact;
}
