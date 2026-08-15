"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { toISODate } from "@/lib/weekUtils";

export const HABIT_CATEGORIES = [
  "study",
  "exercise",
  "reading",
  "sleep",
  "focus",
  "custom",
] as const;
export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

export const HABIT_CATEGORY_LABELS: Record<HabitCategory, string> = {
  study: "Study",
  exercise: "Exercise",
  reading: "Reading",
  sleep: "Sleep",
  focus: "Focus",
  custom: "Custom",
};

export const GOAL_TYPES = ["completion", "count", "duration", "quantity"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const FREQUENCY_TYPES = ["daily", "weekly"] as const;
export type FrequencyType = (typeof FREQUENCY_TYPES)[number];

export const HABIT_STATUSES = ["active", "paused", "archived"] as const;
export type HabitStatus = (typeof HABIT_STATUSES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  completion: "Completion",
  count: "Count",
  duration: "Duration",
  quantity: "Quantity",
};

export interface Habit {
  id: string;
  schoolId: string;
  studentId: string;
  name: string;
  description: string | null;
  category: HabitCategory;
  icon: string;
  goalType: GoalType;
  targetValue: number;
  targetUnit: string | null;
  frequencyType: FrequencyType;
  /** 0 = Mon .. 6 = Sun. */
  scheduledDays: number[];
  status: HabitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  /** YYYY-MM-DD (local). */
  entryDate: string;
  value: number;
  completed: boolean;
}

export interface HabitPause {
  id: string;
  habitId: string;
  startedAt: string;
  endedAt: string | null;
}

/** Payload for create/edit. `id` present on edit. */
export interface HabitInput {
  id?: string;
  name: string;
  description: string | null;
  category: HabitCategory;
  icon: string;
  goalType: GoalType;
  targetValue: number;
  targetUnit: string | null;
  frequencyType: FrequencyType;
  scheduledDays: number[];
}

interface HabitContextValue {
  /** Active + paused habits (archived are hidden from the tracker). */
  habits: Habit[];
  /** Archived habits - soft-deleted but restorable, shown in an Archived view. */
  archivedHabits: Habit[];
  entries: HabitEntry[];
  pauses: HabitPause[];
  loading: boolean;
  error: string | null;
  /** Returns an error message on failure, or null on success. */
  addHabit: (input: HabitInput) => Promise<string | null>;
  /** Returns an error message on failure, or null on success. */
  updateHabit: (input: HabitInput) => Promise<string | null>;
  pauseHabit: (habitId: string) => Promise<string | null>;
  resumeHabit: (habitId: string) => Promise<string | null>;
  archiveHabit: (habitId: string) => Promise<string | null>;
  /** Brings an archived habit back as active (history is preserved). */
  restoreHabit: (habitId: string) => Promise<string | null>;
  /** Hard-deletes the habit; its entries and pauses cascade in the DB. */
  deleteHabit: (habitId: string) => Promise<string | null>;
  /** Upsert today's/day value for a habit (never creates duplicates). */
  recordEntry: (habitId: string, date: string, value: number) => Promise<string | null>;
  removeEntry: (habitId: string, date: string) => Promise<string | null>;
  /** Toggle a day: remove if present, else log value 1. */
  toggleDay: (habitId: string, date: string) => Promise<string | null>;
  refetch: () => void;
}

const HabitContext = createContext<HabitContextValue | null>(null);

function mapHabit(r: any): Habit {
  return {
    id: r.id,
    schoolId: r.school_id,
    studentId: r.student_id,
    name: r.name,
    description: r.description,
    category: r.category,
    icon: r.icon,
    goalType: r.goal_type,
    targetValue: Number(r.target_value),
    targetUnit: r.target_unit,
    frequencyType: r.frequency_type,
    scheduledDays: Array.isArray(r.scheduled_days) ? r.scheduled_days.map(Number) : [],
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapEntry(r: any): HabitEntry {
  return {
    id: r.id,
    habitId: r.habit_id,
    entryDate: r.entry_date,
    value: Number(r.value),
    completed: r.completed,
  };
}

function mapPause(r: any): HabitPause {
  return {
    id: r.id,
    habitId: r.habit_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
  };
}

/**
 * Loads the current student's habits, entries, and pause windows from
 * Supabase (all student-scoped, RLS-enforced), and keeps them live through
 * postgres_changes on the three tables. Writes go straight to the DB -
 * entries are upserted on (student_id, habit_id, entry_date), so a repeated
 * tap updates the existing record instead of creating a duplicate.
 *
 * Habits are personal tracking data: nothing here touches the rank engine,
 * grades, or any academic record.
 */
export function HabitProvider({ children }: { children: ReactNode }) {
  const { profile } = useMyProfile();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [pauses, setPauses] = useState<HabitPause[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);
  // Only the first load shows the skeleton - background refetches (after a
  // toggle/save or a realtime event) swap data silently so numbers update
  // without the page flashing.
  const hasLoaded = useRef(false);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return; // profile still resolving - keep the skeleton
    if (profile.role !== "student") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      if (!hasLoaded.current) setLoading(true);
      const [{ data: habitRows }, { data: entryRows }, { data: pauseRows }] = (await Promise.all([
        supabase.from("habits").select("*").eq("student_id", profile!.id),
        supabase.from("habit_entries").select("*").eq("student_id", profile!.id),
        supabase.from("habit_pauses").select("*").eq("student_id", profile!.id),
      ])) as any[];

      if (cancelled) return;

      if (habitRows === null || entryRows === null || pauseRows === null) {
        setError("Couldn't load your habits. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const all = (habitRows as any[]).map(mapHabit);
      setHabits(all.filter((h) => h.status !== "archived"));
      setArchivedHabits(all.filter((h) => h.status === "archived"));
      setEntries((entryRows as any[]).map(mapEntry));
      setPauses((pauseRows as any[]).map(mapPause));
      setError(null);
      hasLoaded.current = true;
      setLoading(false);
    }

    loadAll();

    const channel = supabase
      .channel(`habits-${profile!.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "habits", filter: `student_id=eq.${profile!.id}` },
        () => {
          if (!cancelled) refetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "habit_entries", filter: `student_id=eq.${profile!.id}` },
        () => {
          if (!cancelled) refetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "habit_pauses", filter: `student_id=eq.${profile!.id}` },
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

  const rowFor = useCallback(
    (input: HabitInput) => {
      if (!profile) throw new Error("profile missing");
      return {
        school_id: profile.school_id,
        student_id: profile.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category,
        icon: input.icon,
        goal_type: input.goalType,
        target_value: input.targetValue,
        target_unit: input.targetUnit,
        frequency_type: input.frequencyType,
        scheduled_days: input.scheduledDays,
      };
    },
    [profile]
  );

  function friendlyError(err: any, fallback: string): string {
    const msg = String(err?.message ?? "");
    if (/duplicate key|unique constraint/i.test(msg)) {
      return "You already have a habit with that name.";
    }
    if (/row-level security/i.test(msg)) {
      return "You can only manage your own habits.";
    }
    return fallback;
  }

  const addHabit = useCallback(
    async (input: HabitInput): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient() as any;
      const { data, error: insertError } = (await supabase
        .from("habits")
        .insert(rowFor(input))
        .select()
        .single()) as any;
      if (insertError || !data) {
        return friendlyError(insertError, "Couldn't create that habit. Please try again.");
      }
      setHabits((prev) => [...prev, mapHabit(data)]);
      return null;
    },
    [profile, rowFor]
  );

  const updateHabit = useCallback(
    async (input: HabitInput): Promise<string | null> => {
      if (!profile || !input.id) return "Habit not found.";
      const supabase = createClient() as any;
      const { data, error: updateError } = (await supabase
        .from("habits")
        .update({ ...rowFor(input), updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select()
        .single()) as any;
      if (updateError || !data) {
        return friendlyError(updateError, "Couldn't save that habit. Please try again.");
      }
      setHabits((prev) => prev.map((h) => (h.id === data.id ? mapHabit(data) : h)));
      return null;
    },
    [profile, rowFor]
  );

  const pauseHabit = useCallback(
    async (habitId: string): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient() as any;
      const today = toISODate(new Date());
      const { error: statusError } = (await supabase
        .from("habits")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", habitId)) as any;
      if (statusError) return friendlyError(statusError, "Couldn't pause that habit. Please try again.");

      // Close any already-open pause window first - a double-tap on Pause must
      // never create duplicate open windows (resume expects at most one).
      const { data: openPause, error: findErr } = (await supabase
        .from("habit_pauses")
        .select("id")
        .eq("habit_id", habitId)
        .is("ended_at", null)
        .maybeSingle()) as any;
      if (findErr) return friendlyError(findErr, "Couldn't pause that habit. Please try again.");
      if (openPause) {
        await supabase.from("habit_pauses").update({ ended_at: today }).eq("id", openPause.id);
      }

      const { data: pauseRow, error: pauseError } = (await supabase
        .from("habit_pauses")
        .insert({
          school_id: profile.school_id,
          student_id: profile.id,
          habit_id: habitId,
          started_at: today,
        })
        .select()
        .single()) as any;
      if (pauseError) {
        // Status changed but the pause window failed - revert the status.
        await supabase.from("habits").update({ status: "active" }).eq("id", habitId);
        return friendlyError(pauseError, "Couldn't pause that habit. Please try again.");
      }
      setPauses((prev) => [...prev, mapPause(pauseRow)]);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, status: "paused" } : h)));
      return null;
    },
    [profile]
  );

  const resumeHabit = useCallback(
    async (habitId: string): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient() as any;
      const today = toISODate(new Date());
      const { error: statusError } = (await supabase
        .from("habits")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", habitId)) as any;
      if (statusError) return friendlyError(statusError, "Couldn't resume that habit. Please try again.");

      const { data: openPause, error: findError } = (await supabase
        .from("habit_pauses")
        .select("*")
        .eq("habit_id", habitId)
        .is("ended_at", null)
        .maybeSingle()) as any;
      if (findError) return friendlyError(findError, "Couldn't resume that habit. Please try again.");

      if (openPause) {
        const { error: closeError } = (await supabase
          .from("habit_pauses")
          .update({ ended_at: today })
          .eq("id", openPause.id)) as any;
        if (closeError) return friendlyError(closeError, "Couldn't resume that habit. Please try again.");
        setPauses((prev) => prev.map((p) => (p.id === openPause.id ? { ...p, endedAt: today } : p)));
      }

      setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, status: "active" } : h)));
      return null;
    },
    [profile]
  );

  const archiveHabit = useCallback(
    async (habitId: string): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient() as any;
      const { data, error } = (await supabase
        .from("habits")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", habitId)
        .select()
        .single()) as any;
      if (error || !data) return friendlyError(error, "Couldn't archive that habit. Please try again.");
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      setArchivedHabits((prev) => [...prev.filter((h) => h.id !== habitId), mapHabit(data)]);
      return null;
    },
    [profile]
  );

  const restoreHabit = useCallback(
    async (habitId: string): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient() as any;
      const { data, error: updateError } = (await supabase
        .from("habits")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", habitId)
        .select()
        .single()) as any;
      if (updateError || !data) {
        return friendlyError(updateError, "Couldn't restore that habit. Please try again.");
      }
      const restored = mapHabit(data);
      setHabits((prev) => [...prev, restored]);
      setArchivedHabits((prev) => prev.filter((h) => h.id !== habitId));
      return null;
    },
    [profile]
  );

  const deleteHabit = useCallback(
    async (habitId: string): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient() as any;
      const { error } = (await supabase
        .from("habits")
        .delete()
        .eq("id", habitId)
        .eq("student_id", profile.id)) as any;
      if (error) return friendlyError(error, "Couldn't delete that habit. Please try again.");
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      setArchivedHabits((prev) => prev.filter((h) => h.id !== habitId));
      setEntries((prev) => prev.filter((e) => e.habitId !== habitId));
      setPauses((prev) => prev.filter((p) => p.habitId !== habitId));
      return null;
    },
    [profile]
  );

  const recordEntry = useCallback(
    async (habitId: string, date: string, value: number): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const habit = habits.find((h) => h.id === habitId);
      const completed =
        !habit || habit.frequencyType === "weekly" ? value >= 1 : value >= habit.targetValue;

      const supabase = createClient() as any;
      const { error } = (await supabase.from("habit_entries").upsert(
        {
          school_id: profile.school_id,
          student_id: profile.id,
          habit_id: habitId,
          entry_date: date,
          value,
          completed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,habit_id,entry_date" }
      )) as any;
      if (error) return friendlyError(error, "Couldn't save your progress. Please try again.");

      // Reconcile with the server truth (the upsert may have updated a row).
      refetch();
      return null;
    },
    [profile, habits, refetch]
  );

  const removeEntry = useCallback(
    async (habitId: string, date: string): Promise<string | null> => {
      if (!profile) return "You need to be signed in.";
      const supabase = createClient() as any;
      const { error } = (await supabase
        .from("habit_entries")
        .delete()
        .eq("student_id", profile.id)
        .eq("habit_id", habitId)
        .eq("entry_date", date)) as any;
      if (error) return friendlyError(error, "Couldn't update your habit. Please try again.");
      refetch();
      return null;
    },
    [profile, refetch]
  );

  const toggleDay = useCallback(
    async (habitId: string, date: string): Promise<string | null> => {
      const existing = entries.find((e) => e.habitId === habitId && e.entryDate === date);
      if (existing) return removeEntry(habitId, date);
      return recordEntry(habitId, date, 1);
    },
    [entries, recordEntry, removeEntry]
  );

  return (
    <HabitContext.Provider
      value={{
        habits,
        archivedHabits,
        entries,
        pauses,
        loading,
        error,
        addHabit,
        updateHabit,
        pauseHabit,
        resumeHabit,
        archiveHabit,
        restoreHabit,
        deleteHabit,
        recordEntry,
        removeEntry,
        toggleDay,
        refetch,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error("useHabits must be used within HabitProvider");
  return ctx;
}
