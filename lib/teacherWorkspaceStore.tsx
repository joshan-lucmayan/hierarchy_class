"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { randomId } from "@/lib/randomId";

export interface TeacherNote {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
}

export interface ScheduleItem {
  id: string;
  day: string;
  startTime: string; // 24h "HH:MM"
  endTime: string; // 24h "HH:MM"
  subject: string;
}

export interface LessonPlanItem {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // 24h "HH:MM", optional - empty string means "all day"
  endTime: string; // 24h "HH:MM", optional - empty string means "all day"
}

// Legacy localStorage keys - the workspace used to live only in the browser.
// On first load with an empty database we migrate these rows up, then clear them.
const STORAGE_NOTES = "hc-teacher-notes";
const STORAGE_SCHEDULE = "hc-teacher-schedule";
const STORAGE_LESSON_PLANS = "hc-teacher-lesson-plans";

interface TeacherWorkspaceContextValue {
  notes: TeacherNote[];
  addNote: (text: string) => void;
  updateNote: (id: string, text: string) => void;
  removeNote: (id: string) => void;
  togglePinNote: (id: string) => void;

  scheduleItems: ScheduleItem[];
  addScheduleItem: (item: Omit<ScheduleItem, "id">) => void;
  removeScheduleItem: (id: string) => void;

  lessonPlans: LessonPlanItem[];
  addLessonPlan: (item: Omit<LessonPlanItem, "id">) => void;
  updateLessonPlan: (id: string, patch: Partial<Omit<LessonPlanItem, "id">>) => void;
  removeLessonPlan: (id: string) => void;

  loading: boolean;
  error: string | null;
}

const TeacherWorkspaceContext = createContext<TeacherWorkspaceContextValue | null>(null);

function loadLegacy<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function clearLegacy() {
  try {
    window.localStorage.removeItem(STORAGE_NOTES);
    window.localStorage.removeItem(STORAGE_SCHEDULE);
    window.localStorage.removeItem(STORAGE_LESSON_PLANS);
  } catch {
    // ignore - storage may be unavailable
  }
}

export function TeacherWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();
    const teacherId = profile.id;
    const schoolId = profile.school_id;

    async function loadAll() {
      const [notesRes, schedRes, plansRes] = await Promise.all([
        supabase.from("teacher_notes").select("*").eq("teacher_id", teacherId).order("created_at", { ascending: false }),
        supabase.from("teacher_schedule").select("*").eq("teacher_id", teacherId).order("created_at", { ascending: true }),
        supabase.from("teacher_lesson_plans").select("*").eq("teacher_id", teacherId).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      if (notesRes.error || schedRes.error || plansRes.error) {
        setError("Couldn't load your workspace.");
        setLoading(false);
        return;
      }

      const notesRows = (notesRes.data ?? []) as any[];
      const schedRows = (schedRes.data ?? []) as any[];
      const planRows = (plansRes.data ?? []) as any[];

      // One-time migration: if the database is empty for this teacher but the
      // old browser-only workspace has data, seed it into Postgres.
      if (
        notesRows.length === 0 &&
        schedRows.length === 0 &&
        planRows.length === 0
      ) {
        const legacyNotes = loadLegacy<TeacherNote>(STORAGE_NOTES);
        const legacySched = loadLegacy<ScheduleItem>(STORAGE_SCHEDULE);
        const legacyPlans = loadLegacy<LessonPlanItem>(STORAGE_LESSON_PLANS);
        if (legacyNotes.length + legacySched.length + legacyPlans.length > 0) {
          await Promise.all([
            legacyNotes.length > 0
              ? supabase.from("teacher_notes").insert(
                  legacyNotes.map((n) => ({
                    school_id: schoolId,
                    teacher_id: teacherId,
                    text: n.text,
                    pinned: n.pinned,
                    created_at: n.createdAt || new Date().toISOString(),
                  })) as any
                )
              : Promise.resolve(),
            legacySched.length > 0
              ? supabase.from("teacher_schedule").insert(
                  legacySched.map((s) => ({
                    school_id: schoolId,
                    teacher_id: teacherId,
                    day: s.day,
                    start_time: s.startTime,
                    end_time: s.endTime,
                    subject: s.subject,
                  })) as any
                )
              : Promise.resolve(),
            legacyPlans.length > 0
              ? supabase.from("teacher_lesson_plans").insert(
                  legacyPlans.map((p) => ({
                    school_id: schoolId,
                    teacher_id: teacherId,
                    title: p.title,
                    description: p.description || null,
                    plan_date: p.date,
                    start_time: p.startTime || "",
                    end_time: p.endTime || "",
                  })) as any
                )
              : Promise.resolve(),
          ]);
          clearLegacy();
          await loadAll();
          return;
        }
      }
      clearLegacy();

      if (cancelled) return;
      setNotes(
        notesRows.map((r: any) => ({
          id: r.id,
          text: r.text,
          pinned: r.pinned,
          createdAt: r.created_at,
        }))
      );
      setScheduleItems(
        schedRows.map((r: any) => ({
          id: r.id,
          day: r.day,
          startTime: r.start_time,
          endTime: r.end_time,
          subject: r.subject,
        }))
      );
      setLessonPlans(
        planRows.map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description ?? "",
          date: r.plan_date,
          startTime: r.start_time || "",
          endTime: r.end_time || "",
        }))
      );
      setError(null);
      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile]);

  /** Runs an optimistic update, then persists to the DB. Refetches on failure. */
  const persist = useCallback(
    async (op: "note" | "schedule" | "plan", action: () => Promise<{ error: unknown }>) => {
      const { error: writeError } = await action();
      if (writeError) {
        setError("Couldn't save your workspace. Please try again.");
        // Refetch to resync with what actually persisted.
        if (profile) {
          const supabase = createClient();
          const table =
            op === "note" ? "teacher_notes" : op === "schedule" ? "teacher_schedule" : "teacher_lesson_plans";
          const { data } = await (supabase.from(table) as any)
            .select("*")
            .eq("teacher_id", profile.id)
            .order("created_at", { ascending: op === "schedule" });
          if (data) {
            if (op === "note") setNotes(data.map((r: any) => ({ id: r.id, text: r.text, pinned: r.pinned, createdAt: r.created_at })));
            else if (op === "schedule") setScheduleItems(data.map((r: any) => ({ id: r.id, day: r.day, startTime: r.start_time, endTime: r.end_time, subject: r.subject })));
            else setLessonPlans(data.map((r: any) => ({ id: r.id, title: r.title, description: r.description ?? "", date: r.plan_date, startTime: r.start_time || "", endTime: r.end_time || "" })));
          }
        }
      } else {
        setError(null);
      }
    },
    [profile]
  );

  // --- Notes ---
  function addNote(text: string) {
    if (!text.trim()) return;
    const tempId = randomId();
    const createdAt = new Date().toISOString();
    setNotes((prev) => [{ id: tempId, text, pinned: false, createdAt }, ...prev]);
    if (!profile) return;
    void persist("note", () =>
      (createClient().from("teacher_notes") as any).insert({
        school_id: profile.school_id,
        teacher_id: profile.id,
        text,
        pinned: false,
        created_at: createdAt,
      })
    );
  }

  function updateNote(id: string, text: string) {
    if (!text.trim()) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
    if (!profile) return;
    void persist("note", () =>
      (createClient().from("teacher_notes") as any).update({ text }).eq("id", id)
    );
  }

  function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (!profile) return;
    void persist("note", () =>
      (createClient().from("teacher_notes") as any).delete().eq("id", id)
    );
  }

  function togglePinNote(id: string) {
    setNotes((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target) {
        void persist("note", () =>
          (createClient().from("teacher_notes") as any)
            .update({ pinned: !target.pinned })
            .eq("id", id)
        );
      }
      return prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
    });
  }

  // --- Schedule ---
  function addScheduleItem(item: Omit<ScheduleItem, "id">) {
    const tempId = randomId();
    setScheduleItems((prev) => [...prev, { id: tempId, ...item }]);
    if (!profile) return;
    void persist("schedule", () =>
      (createClient().from("teacher_schedule") as any).insert({
        school_id: profile.school_id,
        teacher_id: profile.id,
        day: item.day,
        start_time: item.startTime,
        end_time: item.endTime,
        subject: item.subject,
      })
    );
  }

  function removeScheduleItem(id: string) {
    setScheduleItems((prev) => prev.filter((s) => s.id !== id));
    if (!profile) return;
    void persist("schedule", () =>
      (createClient().from("teacher_schedule") as any).delete().eq("id", id)
    );
  }

  // --- Lesson plans ---
  function addLessonPlan(item: Omit<LessonPlanItem, "id">) {
    const tempId = randomId();
    setLessonPlans((prev) => [{ id: tempId, ...item }, ...prev]);
    if (!profile) return;
    void persist("plan", () =>
      (createClient().from("teacher_lesson_plans") as any).insert({
        school_id: profile.school_id,
        teacher_id: profile.id,
        title: item.title,
        description: item.description || null,
        plan_date: item.date,
        start_time: item.startTime || "",
        end_time: item.endTime || "",
      })
    );
  }

  function updateLessonPlan(id: string, patch: Partial<Omit<LessonPlanItem, "id">>) {
    setLessonPlans((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    if (!profile) return;
    void persist("plan", () =>
      (createClient().from("teacher_lesson_plans") as any)
        .update({
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.description !== undefined && { description: patch.description || null }),
          ...(patch.date !== undefined && { plan_date: patch.date }),
          ...(patch.startTime !== undefined && { start_time: patch.startTime || "" }),
          ...(patch.endTime !== undefined && { end_time: patch.endTime || "" }),
        })
        .eq("id", id)
    );
  }

  function removeLessonPlan(id: string) {
    setLessonPlans((prev) => prev.filter((l) => l.id !== id));
    if (!profile) return;
    void persist("plan", () =>
      (createClient().from("teacher_lesson_plans") as any).delete().eq("id", id)
    );
  }

  return (
    <TeacherWorkspaceContext.Provider
      value={{
        notes,
        addNote,
        updateNote,
        removeNote,
        togglePinNote,
        scheduleItems,
        addScheduleItem,
        removeScheduleItem,
        lessonPlans,
        addLessonPlan,
        updateLessonPlan,
        removeLessonPlan,
        loading,
        error,
      }}
    >
      {children}
    </TeacherWorkspaceContext.Provider>
  );
}

export function useTeacherWorkspace() {
  const ctx = useContext(TeacherWorkspaceContext);
  if (!ctx) throw new Error("useTeacherWorkspace must be used within TeacherWorkspaceProvider");
  return ctx;
}
