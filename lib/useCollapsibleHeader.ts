"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * Scroll-collapsible header state for the standalone Android app.
 *
 * On Android the sticky header collapses to a compact strip (essential
 * back/menu control only) when the user scrolls DOWN, and returns to the
 * full header when the user scrolls UP — a common native pattern that keeps
 * the essential navigation reachable while reclaiming vertical space. On the
 * web/desktop/tablet this hook always reports `false`, so those layouts keep
 * their existing fixed header behavior (no unintended behavior change).
 *
 * - Uses the window scroll listener (the app shell scrolls at the document
 *   level) with passive:true — no layout thrash, WebView-compatible.
 * - `compact` only flips once the user has scrolled past a small threshold,
 *   so a fling from the top never jitters the header into a hidden state.
 * - Scrolling up (or returning to the top) always expands again.
 */

export function useCollapsibleHeader(threshold = 72): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let lastY = window.scrollY;
    let lastDir: "up" | "down" = "up";
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dir: "up" | "down" = y > lastY ? "down" : y < lastY ? "up" : lastDir;
        if (dir === "down" && y > threshold) setCompact(true);
        else if (dir === "up") setCompact(false);
        lastY = y;
        lastDir = dir;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return compact;
}
