"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface ClassSection {
  id: string;
  subjectName: string;
  levelLabel: string;
  section: string;
}

export interface StudentGradeEntry {
  quiz: string;
  exam: string;
}

const STORAGE_CLASSES = "hc-teacher-classes";
const STORAGE_GRADES = "hc-teacher-grades";
const STORAGE_SUBMITTED = "hc-teacher-grades-submitted";

interface ClassroomContextValue {
  classes: ClassSection[];
  addClass: (input: Omit<ClassSection, "id">) => void;
  removeClass: (id: string) => void;

  getGrade: (classId: string, studentId: string) => StudentGradeEntry;
  setGrade: (classId: string, studentId: string, field: keyof StudentGradeEntry, value: string) => void;

  isSubmitted: (classId: string) => string | null;
  submitGrades: (classId: string) => void;
}

const ClassroomContext = createContext<ClassroomContextValue | null>(null);

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ClassroomProvider({ children }: { children: React.ReactNode }) {
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [grades, setGrades] = useState<Record<string, Record<string, StudentGradeEntry>>>({});
  const [submitted, setSubmitted] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setClasses(loadJSON<ClassSection[]>(STORAGE_CLASSES, []));
    setGrades(loadJSON<Record<string, Record<string, StudentGradeEntry>>>(STORAGE_GRADES, {}));
    setSubmitted(loadJSON<Record<string, string>>(STORAGE_SUBMITTED, {}));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_CLASSES, JSON.stringify(classes));
  }, [classes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_GRADES, JSON.stringify(grades));
  }, [grades, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_SUBMITTED, JSON.stringify(submitted));
  }, [submitted, hydrated]);

  function addClass(input: Omit<ClassSection, "id">) {
    setClasses((prev) => [...prev, { id: `class-${Date.now()}`, ...input }]);
  }

  function removeClass(id: string) {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  }

  function getGrade(classId: string, studentId: string): StudentGradeEntry {
    return grades[classId]?.[studentId] ?? { quiz: "", exam: "" };
  }

  function setGrade(classId: string, studentId: string, field: keyof StudentGradeEntry, value: string) {
    setGrades((prev) => {
      const classGrades = prev[classId] ?? {};
      const studentGrade = classGrades[studentId] ?? { quiz: "", exam: "" };
      return {
        ...prev,
        [classId]: {
          ...classGrades,
          [studentId]: { ...studentGrade, [field]: value },
        },
      };
    });
    // Resubmitting after an edit should require a fresh submit.
    setSubmitted((prev) => {
      if (!prev[classId]) return prev;
      const next = { ...prev };
      delete next[classId];
      return next;
    });
  }

  function isSubmitted(classId: string): string | null {
    return submitted[classId] ?? null;
  }

  function submitGrades(classId: string) {
    setSubmitted((prev) => ({ ...prev, [classId]: new Date().toISOString() }));
  }

  return (
    <ClassroomContext.Provider
      value={{ classes, addClass, removeClass, getGrade, setGrade, isSubmitted, submitGrades }}
    >
      {children}
    </ClassroomContext.Provider>
  );
}

export function useClassroom() {
  const ctx = useContext(ClassroomContext);
  if (!ctx) throw new Error("useClassroom must be used within ClassroomProvider");
  return ctx;
}
