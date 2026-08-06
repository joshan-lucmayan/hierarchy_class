"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type TierRank = "S++" | "S" | "A" | "B" | "C" | "D";
export type GradeType = "Exam" | "Quiz" | "Activity" | "Assignment";

export interface Program {
  id: string;
  name: string;
  description?: string;
}

export interface Section {
  id: string;
  programId: string;
  name: string;
}

export interface Course {
  id: string;
  sectionId: string;
  name: string;
  code?: string;
}

export interface Student {
  id: string;
  courseId: string;
  name: string;
  profileId?: string; // links to the real signed-up profile in Supabase
}

export interface GradeEntry {
  id: string;
  studentId: string;
  courseId: string;
  type: GradeType;
  score: number;
  date: string;
  label?: string;
}

function computeRank(avg: number): TierRank {
  if (avg >= 97) return "S++";
  if (avg >= 90) return "S";
  if (avg >= 80) return "A";
  if (avg >= 70) return "B";
  if (avg >= 60) return "C";
  return "D";
}

interface ClassroomHierarchyContextType {
  programs: Program[];
  sections: Section[];
  courses: Course[];
  students: Student[];
  gradeEntries: GradeEntry[];

  addProgram: (p: Omit<Program, "id">) => void;
  updateProgram: (id: string, p: Omit<Program, "id">) => void;
  deleteProgram: (id: string) => void;

  addSection: (s: Omit<Section, "id">) => void;
  updateSection: (id: string, s: Omit<Section, "id">) => void;
  deleteSection: (id: string) => void;

  addCourse: (c: Omit<Course, "id">) => void;
  updateCourse: (id: string, c: Omit<Course, "id">) => void;
  deleteCourse: (id: string) => void;

  addStudent: (s: Omit<Student, "id">) => void;
  deleteStudent: (id: string) => void;

  submitGrades: (entries: Omit<GradeEntry, "id">[]) => void;
  deleteGradeEntry: (id: string) => void;

  getSectionsByProgram: (programId: string) => Section[];
  getCoursesBySection: (sectionId: string) => Course[];
  getStudentsByCourse: (courseId: string) => Student[];
  getEntriesByStudent: (studentId: string) => GradeEntry[];
  getEntriesByCourse: (courseId: string) => GradeEntry[];
  getStudentAverage: (studentId: string) => number | null;
  getStudentRank: (studentId: string) => TierRank | null;
  getCourseLeaderboard: (courseId: string) => { student: Student; avg: number; rank: TierRank }[];
}

const ClassroomHierarchyContext = createContext<ClassroomHierarchyContextType | null>(null);

const MOCK_PROGRAMS: Program[] = [
  { id: "prog-1", name: "Senior High School - Science Track", description: "Grades 11-12" },
  { id: "prog-2", name: "Senior High School - Humanities Track", description: "Grades 11-12" },
];

const MOCK_SECTIONS: Section[] = [
  { id: "sec-1", programId: "prog-1", name: "Grade 11" },
  { id: "sec-2", programId: "prog-1", name: "Grade 12" },
  { id: "sec-3", programId: "prog-2", name: "Grade 11" },
  { id: "sec-4", programId: "prog-2", name: "Grade 12" },
];

const MOCK_COURSES: Course[] = [
  { id: "crs-1", sectionId: "sec-1", name: "Physics", code: "PHY101" },
  { id: "crs-2", sectionId: "sec-1", name: "Chemistry", code: "CHM101" },
  { id: "crs-3", sectionId: "sec-2", name: "Physics", code: "PHY201" },
  { id: "crs-4", sectionId: "sec-3", name: "English Literature", code: "ENG101" },
];

const MOCK_STUDENTS: Student[] = [
  { id: "std-1", courseId: "crs-1", name: "Alice Johnson" },
  { id: "std-2", courseId: "crs-1", name: "Bob Smith" },
  { id: "std-3", courseId: "crs-1", name: "Carol Davis" },
  { id: "std-4", courseId: "crs-2", name: "Diana Lopez" },
  { id: "std-5", courseId: "crs-3", name: "Eve Martinez" },
];

const MOCK_GRADES: GradeEntry[] = [
  { id: "g-1", studentId: "std-1", courseId: "crs-1", type: "Quiz", score: 88, date: "2026-07-28", label: "Quiz 1" },
  { id: "g-2", studentId: "std-1", courseId: "crs-1", type: "Exam", score: 91, date: "2026-07-30", label: "Midterm" },
  { id: "g-3", studentId: "std-2", courseId: "crs-1", type: "Quiz", score: 75, date: "2026-07-28", label: "Quiz 1" },
  { id: "g-4", studentId: "std-2", courseId: "crs-1", type: "Exam", score: 82, date: "2026-07-30", label: "Midterm" },
  { id: "g-5", studentId: "std-3", courseId: "crs-1", type: "Quiz", score: 95, date: "2026-07-28", label: "Quiz 1" },
  { id: "g-6", studentId: "std-3", courseId: "crs-1", type: "Exam", score: 97, date: "2026-07-30", label: "Midterm" },
];

export function ClassroomHierarchyProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>(MOCK_PROGRAMS);
  const [sections, setSections] = useState<Section[]>(MOCK_SECTIONS);
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>(MOCK_GRADES);

  const addProgram = useCallback((p: Omit<Program, "id">) => {
    setPrograms((prev) => [...prev, { ...p, id: `prog-${Date.now()}` }]);
  }, []);

  const updateProgram = useCallback((id: string, p: Omit<Program, "id">) => {
    setPrograms((prev) => prev.map((prog) => (prog.id === id ? { ...prog, ...p } : prog)));
  }, []);

  const deleteProgram = useCallback((id: string) => {
    const sectionIdsToRemove = sections.filter((s) => s.programId === id).map((s) => s.id);
    const courseIdsToRemove = courses.filter((c) => sectionIdsToRemove.includes(c.sectionId)).map((c) => c.id);
    const studentIdsToRemove = students.filter((s) => courseIdsToRemove.includes(s.courseId)).map((s) => s.id);

    setPrograms((prev) => prev.filter((prog) => prog.id !== id));
    setSections((prev) => prev.filter((s) => s.programId !== id));
    setCourses((prev) => prev.filter((c) => !sectionIdsToRemove.includes(c.sectionId)));
    setStudents((prev) => prev.filter((s) => !courseIdsToRemove.includes(s.courseId)));
    setGradeEntries((prev) => prev.filter((e) => !studentIdsToRemove.includes(e.studentId)));
  }, [sections, courses, students]);

  const addSection = useCallback((s: Omit<Section, "id">) => {
    setSections((prev) => [...prev, { ...s, id: `sec-${Date.now()}` }]);
  }, []);

  const updateSection = useCallback((id: string, s: Omit<Section, "id">) => {
    setSections((prev) => prev.map((sec) => (sec.id === id ? { ...sec, ...s } : sec)));
  }, []);

  const deleteSection = useCallback((id: string) => {
    const courseIdsToRemove = courses.filter((c) => c.sectionId === id).map((c) => c.id);
    const studentIdsToRemove = students.filter((s) => courseIdsToRemove.includes(s.courseId)).map((s) => s.id);

    setSections((prev) => prev.filter((s) => s.id !== id));
    setCourses((prev) => prev.filter((c) => c.sectionId !== id));
    setStudents((prev) => prev.filter((s) => !courseIdsToRemove.includes(s.courseId)));
    setGradeEntries((prev) => prev.filter((e) => !studentIdsToRemove.includes(e.studentId)));
  }, [courses, students]);

  const addCourse = useCallback((c: Omit<Course, "id">) => {
    setCourses((prev) => [...prev, { ...c, id: `crs-${Date.now()}` }]);
  }, []);

  const updateCourse = useCallback((id: string, c: Omit<Course, "id">) => {
    setCourses((prev) => prev.map((crs) => (crs.id === id ? { ...crs, ...c } : crs)));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    const studentIdsToRemove = students.filter((s) => s.courseId === id).map((s) => s.id);

    setCourses((prev) => prev.filter((c) => c.id !== id));
    setStudents((prev) => prev.filter((s) => s.courseId !== id));
    setGradeEntries((prev) => prev.filter((e) => !studentIdsToRemove.includes(e.studentId) && e.courseId !== id));
  }, [students]);

  const addStudent = useCallback((s: Omit<Student, "id">) => {
    setStudents((prev) => [...prev, { ...s, id: `std-${Date.now()}` }]);
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setGradeEntries((prev) => prev.filter((e) => e.studentId !== id));
  }, []);

  const submitGrades = useCallback((entries: Omit<GradeEntry, "id">[]) => {
    const stamped: GradeEntry[] = entries.map((e, i) => ({
      ...e,
      id: `g-${Date.now()}-${i}`,
    }));
    setGradeEntries((prev) => [...prev, ...stamped]);
  }, []);

  const deleteGradeEntry = useCallback((id: string) => {
    setGradeEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const getSectionsByProgram = useCallback(
    (programId: string) => sections.filter((s) => s.programId === programId),
    [sections]
  );

  const getCoursesBySection = useCallback(
    (sectionId: string) => courses.filter((c) => c.sectionId === sectionId),
    [courses]
  );

  const getStudentsByCourse = useCallback(
    (courseId: string) => students.filter((s) => s.courseId === courseId),
    [students]
  );

  const getEntriesByStudent = useCallback(
    (studentId: string) => gradeEntries.filter((e) => e.studentId === studentId),
    [gradeEntries]
  );

  const getEntriesByCourse = useCallback(
    (courseId: string) => gradeEntries.filter((e) => e.courseId === courseId),
    [gradeEntries]
  );

  const getStudentAverage = useCallback(
    (studentId: string): number | null => {
      const entries = gradeEntries.filter((e) => e.studentId === studentId);
      if (entries.length === 0) return null;
      const sum = entries.reduce((acc, e) => acc + e.score, 0);
      return Math.round((sum / entries.length) * 10) / 10;
    },
    [gradeEntries]
  );

  const getStudentRank = useCallback(
    (studentId: string): TierRank | null => {
      const avg = getStudentAverage(studentId);
      if (avg === null) return null;
      return computeRank(avg);
    },
    [getStudentAverage]
  );

  const getCourseLeaderboard = useCallback(
    (courseId: string) => {
      const courseStudents = students.filter((s) => s.courseId === courseId);
      return courseStudents
        .map((s) => {
          const avg = getStudentAverage(s.id) ?? 0;
          return { student: s, avg, rank: computeRank(avg) };
        })
        .sort((a, b) => b.avg - a.avg);
    },
    [students, getStudentAverage]
  );

  return (
    <ClassroomHierarchyContext.Provider
      value={{
        programs,
        sections,
        courses,
        students,
        gradeEntries,
        addProgram,
        updateProgram,
        deleteProgram,
        addSection,
        updateSection,
        deleteSection,
        addCourse,
        updateCourse,
        deleteCourse,
        addStudent,
        deleteStudent,
        submitGrades,
        deleteGradeEntry,
        getSectionsByProgram,
        getCoursesBySection,
        getStudentsByCourse,
        getEntriesByStudent,
        getEntriesByCourse,
        getStudentAverage,
        getStudentRank,
        getCourseLeaderboard,
      }}
    >
      {children}
    </ClassroomHierarchyContext.Provider>
  );
}

export function useClassroomHierarchy() {
  const ctx = useContext(ClassroomHierarchyContext);
  if (!ctx) throw new Error("useClassroomHierarchy must be used within ClassroomHierarchyProvider");
  return ctx;
}
