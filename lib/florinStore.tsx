"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";

export interface FlorinTransaction {
  id: string;
  amount: number;
  reason: string | null;
  createdAt: string;
}

interface FlorinContextValue {
  balance: number;
  transactions: FlorinTransaction[];
  loading: boolean;
  error: string | null;
  addFlorin: (amount: number, reason?: string) => Promise<void>;
  refetch: () => void;
}

const FlorinContext = createContext<FlorinContextValue | null>(null);

export function FlorinProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<FlorinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile || profile.role !== "student") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      setLoading(true);

      const [{ data: balanceRow, error: balanceErr }, { data: txData, error: txErr }] = (await Promise.all([
        supabase.from("florin_balances").select("*").eq("student_id", profile!.id).maybeSingle(),
        supabase
          .from("florin_transactions")
          .select("*")
          .eq("student_id", profile!.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ])) as any[];

      if (cancelled) return;

      if (balanceErr || txErr) {
        setError("Couldn't load your Florin balance. Please refresh and try again.");
        setLoading(false);
        return;
      }

      setBalance((balanceRow as any)?.balance ?? 0);
      setTransactions(
        ((txData ?? []) as any[]).map((t) => ({
          id: t.id,
          amount: t.amount,
          reason: t.reason,
          createdAt: t.created_at,
        }))
      );
      setError(null);
      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  const addFlorin = useCallback(
    async (amount: number, reason?: string) => {
      if (!profile) return;
      const supabase = createClient();

      await (supabase.from("florin_transactions") as any).insert({
        school_id: profile.school_id,
        student_id: profile.id,
        amount,
        reason: reason ?? null,
      });

      const newBalance = balance + amount;
      await (supabase.from("florin_balances") as any)
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("student_id", profile.id);

      setBalance(newBalance);
      refetch();
    },
    [profile, balance, refetch]
  );

  return (
    <FlorinContext.Provider value={{ balance, transactions, loading, error, addFlorin, refetch }}>
      {children}
    </FlorinContext.Provider>
  );
}

export function useFlorin() {
  const ctx = useContext(FlorinContext);
  if (!ctx) throw new Error("useFlorin must be used within FlorinProvider");
  return ctx;
}
