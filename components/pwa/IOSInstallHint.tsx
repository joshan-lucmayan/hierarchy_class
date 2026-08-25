"use client";

import { useEffect, useState } from "react";

export function IOSInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandalone) {
      const dismissed = localStorage.getItem("hc-ios-hint-dismissed");
      if (!dismissed) setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-sm rounded-[10px] border border-gold-soft bg-surface p-4 shadow-xl supports-[bottom:env(safe-area-inset-bottom)]:bottom-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy">Install on iPhone/iPad</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Tap <span className="font-semibold text-navy">Share</span> then <span className="font-semibold text-navy">Add to Home Screen</span> to install Hierarchy Class.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem("hc-ios-hint-dismissed", "1");
            setShow(false);
          }}
          aria-label="Dismiss"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base text-muted hover:border-gold"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
