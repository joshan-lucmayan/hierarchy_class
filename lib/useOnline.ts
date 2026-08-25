"use client";

import { useEffect, useState } from "react";

/**
 * Network status hook — single source of truth for offline awareness.
 * Students/teachers must never see fake success for network-required actions;
 * this hook lets callers block mutations and show a clear explanation instead.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    // navigator.onLine is true on server, so sync on mount
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
