"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CURRENT_STUDENT } from "@/data/mockStudents";

const STORAGE_BALANCE = "hc-florin-balance";

interface FlorinContextValue {
  balance: number;
  addFlorin: (amount: number) => void;
}

const FlorinContext = createContext<FlorinContextValue | null>(null);

export function FlorinProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number>(CURRENT_STUDENT.florinBalance);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_BALANCE);
      if (saved) setBalance(Number(saved));
    } catch {
      // ignore corrupted/unavailable storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_BALANCE, String(balance));
    } catch {
      // ignore storage write failures
    }
  }, [balance, hydrated]);

  function addFlorin(amount: number) {
    setBalance((prev) => prev + amount);
  }

  return <FlorinContext.Provider value={{ balance, addFlorin }}>{children}</FlorinContext.Provider>;
}

export function useFlorin() {
  const ctx = useContext(FlorinContext);
  if (!ctx) throw new Error("useFlorin must be used within FlorinProvider");
  return ctx;
}
