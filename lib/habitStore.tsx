"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { getCurrentWeek } from "@/lib/weekUtils";

export const HABIT_TYPES = ["study", "exercise", "reading", "sleep", "focus"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

export const HABIT_LABELS: Record<HabitType, string> = {
  study: "Study",
  exercise: "Exercise",
  reading: "Reading",
  sleep: "Sleep",
  focus: "Focus",
};

export interface HabitEntry {
  id: string;
  habitType: HabitType;
  /** YYYY-MM-DD in the user's local timezone (matches DB entry_date). */
  entryDate: string;
  completed: boolean;
}

interface HabitContextValue {
  entries: HabitEntry[];
  loading: boolean;
  error: string | null;
  toggleHabit: (type: HabitType, date: string) => Promise<void>;
  refetch: () => void;
}

const HabitContext = createContext<HabitContextValue | null>(null);

/**
 * Loads the current student's habit entries for THIS ISO week (Mon-Sun, local
 * timezone) from the real habit_entries table, writes toggles straight to
 * Supabase, and subscribes to realtime so other tabs/devices stay in sync.
 * Mirrors the FlorinProvider pattern (fetch on mount -> realtime -> cleanup).
 */
export function HabitProvider({ children }: { children: ReactNode }) {
  const { profile } = useMyProfile();
  const [entries, setEntries] = useState<HabitEntry[]>([]);
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
    const { start, end } = getCurrentWeek();

    async function loadAll() {
      setLoading(true);

      const { data, error: queryError } = (await supabase
        .from("habit_entries")
        .select("*")
        .eq("student_id", profile!.id)
        .gte("entry_date", start)
        .lte("entry_date", end)) as any;

      if (cancelled) return;
      if (queryError) {
        setError("Couldn't load your habits. Please refresh and try again.");
        setLoading(false);
        return;
      }

      setEntries(
        ((data ?? []) as any[]).map((r) => ({
          id: r.id,
          habitType: r.habit_type,
          entryDate: r.entry_date,
          completed: r.completed,
        }))
      );
      setError(null);
      setLoading(false);
    }

    loadAll();

    // Realtime: when a habit is toggled (any device), refetch so counts stay
    // live. RLS scopes which events this user receives. One channel, cleaned up.
    const channel = supabase
      .channel("habit-entries")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "habit_entries",
          filter: `student_id=eq.${profile!.id}`,
        },
        () => {
          if (!cancelled) refetch();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  /**
   * Marks/unmarks a habit for a day. The unique(student_id, habit_type,
   * entry_date) constraint means "present = completed": inserting creates the
   * entry, deleting removes it. Optimistic update, reconciled with the real
   * server response on every call.
   */
  const toggleHabit = useCallback(
    async (type: HabitType, date: string) => {
      if (!profile) return;
      const supabase = createClient();
      const existing = entries.find((e) => e.habitType === type && e.entryDate === date);
      const snapshot = entries;

      if (existing) {
        // Optimistic remove, then delete on the server.
        setEntries((prev) => prev.filter((e) => e.id !== existing.id));
        const { error: deleteError } = await supabase
          .from("habit_entries")
          .delete()
          .eq("id", existing.id);
        if (deleteError) {
          setEntries(snapshot);
          setError("Couldn't update your habit. Please try again.");
          return;
        }
      } else {
        // Optimistic add with a temp id; the refetch below replaces it with
        // the real server row (with its actual id).
        setEntries((prev) => [
          ...prev,
          { id: `temp-${type}-${date}`, habitType: type, entryDate: date, completed: true },
        ]);
        const { error: insertError } = await supabase.from("habit_entries").insert({
          school_id: profile.school_id,
          student_id: profile.id,
          habit_type: type,
          entry_date: date,
          completed: true,
        } as any);
        if (insertError) {
          setEntries(snapshot);
          setError("Couldn't update your habit. Please try again.");
          return;
        }
      }

      setError(null);
      refetch(); // reconcile with the real server state
    },
    [profile, entries, refetch]
  );

  return (
    <HabitContext.Provider value={{ entries, loading, error, toggleHabit, refetch }}>
      {children}
    </HabitContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error("useHabits must be used within HabitProvider");
  return ctx;
}
