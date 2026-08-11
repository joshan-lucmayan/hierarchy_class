"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { notifyAdmins } from "@/lib/notify";

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
  teacherId?: string;
  teacherName?: string;
}

export interface Student {
  id: string;
  courseId: string;
  name: string;
  profileId?: string;
}

export interface GradeEntry {
  id: string;
  studentId: string;
  courseId: string;
  submittedBy: string;
  submittedByName: string | null;
  type: GradeType;
  score: number;
  date: string;
  label?: string;
  approvalStatus: "pending" | "approved" | "rejected";
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
  loading: boolean;
  error: string | null;

  addProgram: (p: Omit<Program, "id">) => Promise<void>;
  updateProgram: (id: string, p: Omit<Program, "id">) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;

  addSection: (s: Omit<Section, "id">) => Promise<void>;
  updateSection: (id: string, s: Omit<Section, "id">) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;

  addCourse: (c: Omit<Course, "id">) => Promise<void>;
  updateCourse: (id: string, c: Omit<Course, "id">) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;

  addStudent: (s: Omit<Student, "id">) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;

  submitGrades: (entries: Omit<GradeEntry, "id" | "submittedBy" | "submittedByName" | "approvalStatus">[]) => Promise<void>;
  deleteGradeEntry: (id: string) => Promise<void>;
  setGradeApproval: (id: string, status: "approved" | "rejected") => Promise<void>;

  getSectionsByProgram: (programId: string) => Section[];
  getCoursesBySection: (sectionId: string) => Course[];
  getCoursesByTeacher: (teacherId: string) => Course[];
  getStudentsByCourse: (courseId: string) => Student[];
  getStudentRecordsByProfile: (profileId: string) => Student[];
  getStudentAverageByProfile: (profileId: string) => number | null;
  getStudentRankByProfile: (profileId: string) => TierRank | null;
  getEntriesByProfile: (profileId: string) => GradeEntry[];
  getEntriesByStudent: (studentId: string) => GradeEntry[];
  getEntriesByCourse: (courseId: string) => GradeEntry[];
  getStudentAverage: (studentId: string) => number | null;
  getStudentRank: (studentId: string) => TierRank | null;
  getCourseLeaderboard: (courseId: string) => { student: Student; avg: number; rank: TierRank }[];
}

const ClassroomHierarchyContext = createContext<ClassroomHierarchyContextType | null>(null);

export function ClassroomHierarchyProvider({ children }: { children: ReactNode }) {
  const { profile } = useMyProfile();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
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
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      setLoading(true);

      const [
        { data: programsData, error: programsErr },
        { data: sectionsData, error: sectionsErr },
        { data: coursesData, error: coursesErr },
        { data: enrollData, error: enrollErr },
        { data: gradesData, error: gradesErr },
      ] = (await Promise.all([
        supabase.from("programs").select("*").order("created_at"),
        supabase.from("sections").select("*").order("created_at"),
        supabase.from("courses").select("*, teacher:profiles!teacher_id(full_name)").order("created_at"),
        supabase.from("course_enrollments").select("*, student:profiles!student_id(full_name)").order("created_at"),
        supabase.from("grade_entries").select("*, submitted:profiles!submitted_by(full_name)").order("entry_date", { ascending: false }),
      ])) as any[];

      if (cancelled) return;

      if (programsErr || sectionsErr || coursesErr || enrollErr || gradesErr) {
        setError("Couldn't load classroom data. Please refresh and try again.");
        setLoading(false);
        return;
      }

      setPrograms(
        ((programsData ?? []) as any[]).map((p) => ({ id: p.id, name: p.name, description: p.description ?? undefined }))
      );
      setSections(
        ((sectionsData ?? []) as any[]).map((s) => ({ id: s.id, programId: s.program_id, name: s.name }))
      );
      setCourses(
        ((coursesData ?? []) as any[]).map((c: any) => ({
          id: c.id,
          sectionId: c.section_id,
          name: c.name,
          code: c.code ?? undefined,
          teacherId: c.teacher_id ?? undefined,
          teacherName: c.teacher?.full_name ?? undefined,
        }))
      );
      setStudents(
        ((enrollData ?? []) as any[]).map((e: any) => ({
          id: e.id,
          courseId: e.course_id,
          name: e.student?.full_name ?? "Unknown student",
          profileId: e.student_id,
        }))
      );
      setGradeEntries(
        ((gradesData ?? []) as any[]).map((g: any) => ({
          id: g.id,
          studentId: g.student_id,
          courseId: g.course_id,
          submittedBy: g.submitted_by,
          submittedByName: g.submitted?.full_name ?? null,
          type: g.type,
          score: g.score,
          date: g.entry_date,
          label: g.label ?? undefined,
          approvalStatus: g.approval_status ?? "pending",
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

  const addProgram = useCallback(async (p: Omit<Program, "id">) => {
    if (!profile) return;
    const supabase = createClient();
    await supabase.from("programs").insert({ school_id: profile.school_id, name: p.name, description: p.description ?? null } as any);
    refetch();
  }, [profile, refetch]);

  const updateProgram = useCallback(async (id: string, p: Omit<Program, "id">) => {
    const supabase = createClient();
    await (supabase.from("programs") as any).update({ name: p.name, description: p.description ?? null }).eq("id", id);
    refetch();
  }, [refetch]);

  const deleteProgram = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("programs").delete().eq("id", id);
    refetch();
  }, [refetch]);

  const addSection = useCallback(async (s: Omit<Section, "id">) => {
    if (!profile) return;
    const supabase = createClient();
    await supabase.from("sections").insert({ school_id: profile.school_id, program_id: s.programId, name: s.name } as any);
    refetch();
  }, [profile, refetch]);

  const updateSection = useCallback(async (id: string, s: Omit<Section, "id">) => {
    const supabase = createClient();
    await (supabase.from("sections") as any).update({ name: s.name }).eq("id", id);
    refetch();
  }, [refetch]);

  const deleteSection = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("sections").delete().eq("id", id);
    refetch();
  }, [refetch]);

  const addCourse = useCallback(async (c: Omit<Course, "id">) => {
    if (!profile) return;
    const supabase = createClient();
    await supabase.from("courses").insert({
      school_id: profile.school_id,
      section_id: c.sectionId,
      name: c.name,
      code: c.code ?? null,
      teacher_id: c.teacherId ?? null,
    } as any);
    refetch();
  }, [profile, refetch]);

  const updateCourse = useCallback(async (id: string, c: Omit<Course, "id">) => {
    const supabase = createClient();
    await (supabase.from("courses") as any).update({
      name: c.name,
      code: c.code ?? null,
      teacher_id: c.teacherId ?? null,
    }).eq("id", id);
    refetch();
  }, [refetch]);

  const deleteCourse = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("courses").delete().eq("id", id);
    refetch();
  }, [refetch]);

  const addStudent = useCallback(async (s: Omit<Student, "id">) => {
    if (!profile || !s.profileId) return;
    const supabase = createClient();
    await supabase.from("course_enrollments").insert({
      school_id: profile.school_id,
      course_id: s.courseId,
      student_id: s.profileId,
    } as any);
    refetch();
  }, [profile, refetch]);

  const deleteStudent = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("course_enrollments").delete().eq("id", id);
    refetch();
  }, [refetch]);

  const submitGrades = useCallback(async (entries: Omit<GradeEntry, "id" | "submittedBy" | "submittedByName" | "approvalStatus">[]) => {
    if (!profile) return;
    const supabase = createClient();
    const { error: insertError } = await supabase.from("grade_entries").insert(
      entries.map((e) => ({
        school_id: profile.school_id,
        course_id: e.courseId,
        student_id: e.studentId,
        submitted_by: profile.id,
        type: e.type,
        label: e.label ?? null,
        score: e.score,
        entry_date: e.date,
        approval_status: "pending",
      })) as any
    );
    if (!insertError && entries.length > 0) {
      // Let admins know there's a submission waiting for review.
      const course = courses.find((c) => c.id === entries[0].courseId);
      await notifyAdmins(
        profile.school_id,
        "grade",
        `New grade submission: ${course?.name ?? "a course"}`,
        `${profile.full_name} submitted ${entries.length} grade${entries.length === 1 ? "" : "s"} for approval.`
      );
    }
    refetch();
  }, [profile, courses, refetch]);

  const deleteGradeEntry = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("grade_entries").delete().eq("id", id);
    refetch();
  }, [refetch]);

  const setGradeApproval = useCallback(async (id: string, status: "approved" | "rejected") => {
    const supabase = createClient();
    await (supabase.from("grade_entries") as any)
      .update({ approval_status: status })
      .eq("id", id);
    refetch();
  }, [refetch]);

  const getSectionsByProgram = useCallback(
    (programId: string) => sections.filter((s) => s.programId === programId),
    [sections]
  );
  const getCoursesBySection = useCallback(
    (sectionId: string) => courses.filter((c) => c.sectionId === sectionId),
    [courses]
  );
  const getCoursesByTeacher = useCallback(
    (teacherId: string) => courses.filter((c) => c.teacherId === teacherId),
    [courses]
  );
  const getStudentsByCourse = useCallback(
    (courseId: string) => students.filter((s) => s.courseId === courseId),
    [students]
  );
  const getStudentRecordsByProfile = useCallback(
    (profileId: string) => students.filter((s) => s.profileId === profileId),
    [students]
  );
  const getEntriesByProfile = useCallback(
    (profileId: string) => {
      const studentIds = students.filter((s) => s.profileId === profileId).map((s) => s.id);
      return gradeEntries.filter((e) => studentIds.includes(e.studentId));
    },
    [students, gradeEntries]
  );
  const getStudentAverageByProfile = useCallback(
    (profileId: string): number | null => {
      const studentIds = students.filter((s) => s.profileId === profileId).map((s) => s.id);
      const entries = gradeEntries.filter((e) => studentIds.includes(e.studentId));
      if (entries.length === 0) return null;
      const sum = entries.reduce((acc, e) => acc + e.score, 0);
      return Math.round((sum / entries.length) * 10) / 10;
    },
    [students, gradeEntries]
  );
  const getStudentRankByProfile = useCallback(
    (profileId: string): TierRank | null => {
      const studentIds = students.filter((s) => s.profileId === profileId).map((s) => s.id);
      const entries = gradeEntries.filter((e) => studentIds.includes(e.studentId));
      if (entries.length === 0) return null;
      const sum = entries.reduce((acc, e) => acc + e.score, 0);
      return computeRank(Math.round((sum / entries.length) * 10) / 10);
    },
    [students, gradeEntries]
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
        loading,
        error,
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
        setGradeApproval,
        getSectionsByProgram,
        getCoursesBySection,
        getCoursesByTeacher,
        getStudentsByCourse,
        getStudentRecordsByProfile,
        getStudentAverageByProfile,
        getStudentRankByProfile,
        getEntriesByProfile,
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
