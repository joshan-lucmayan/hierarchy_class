"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
  date: string;
  startTime: string; // 24h "HH:MM", optional - empty string means "all day"
  endTime: string; // 24h "HH:MM", optional - empty string means "all day"
}

const STORAGE_NOTES = "hc-teacher-notes";
const STORAGE_SCHEDULE = "hc-teacher-schedule";
const STORAGE_LESSON_PLANS = "hc-teacher-lesson-plans";

interface TeacherWorkspaceContextValue {
  notes: TeacherNote[];
  addNote: (text: string) => void;
  removeNote: (id: string) => void;
  togglePinNote: (id: string) => void;

  scheduleItems: ScheduleItem[];
  addScheduleItem: (item: Omit<ScheduleItem, "id">) => void;
  removeScheduleItem: (id: string) => void;

  lessonPlans: LessonPlanItem[];
  addLessonPlan: (item: Omit<LessonPlanItem, "id">) => void;
  removeLessonPlan: (id: string) => void;
}

const TeacherWorkspaceContext = createContext<TeacherWorkspaceContextValue | null>(null);

function loadFromStorage<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function TeacherWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlanItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setNotes(loadFromStorage<TeacherNote>(STORAGE_NOTES));
    setScheduleItems(loadFromStorage<ScheduleItem>(STORAGE_SCHEDULE));
    setLessonPlans(loadFromStorage<LessonPlanItem>(STORAGE_LESSON_PLANS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_NOTES, JSON.stringify(notes));
  }, [notes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_SCHEDULE, JSON.stringify(scheduleItems));
  }, [scheduleItems, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_LESSON_PLANS, JSON.stringify(lessonPlans));
  }, [lessonPlans, hydrated]);

  function addNote(text: string) {
    if (!text.trim()) return;
    setNotes((prev) => [
      { id: `note-${Date.now()}`, text, pinned: false, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function togglePinNote(id: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }

  function addScheduleItem(item: Omit<ScheduleItem, "id">) {
    setScheduleItems((prev) => [...prev, { id: `sched-${Date.now()}`, ...item }]);
  }

  function removeScheduleItem(id: string) {
    setScheduleItems((prev) => prev.filter((s) => s.id !== id));
  }

  function addLessonPlan(item: Omit<LessonPlanItem, "id">) {
    setLessonPlans((prev) => [{ id: `lp-${Date.now()}`, ...item }, ...prev]);
  }

  function removeLessonPlan(id: string) {
    setLessonPlans((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <TeacherWorkspaceContext.Provider
      value={{
        notes,
        addNote,
        removeNote,
        togglePinNote,
        scheduleItems,
        addScheduleItem,
        removeScheduleItem,
        lessonPlans,
        addLessonPlan,
        removeLessonPlan,
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
