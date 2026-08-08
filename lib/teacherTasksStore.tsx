"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";

export interface TeacherTask {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "accepted" | "declined" | "done";
  declineReason?: string;
  assignedDate: string;
}

interface TeacherTasksContextType {
  tasks: TeacherTask[];
  loading: boolean;
  error: string | null;
  addTask: (task: Omit<TeacherTask, "id" | "status" | "assignedDate">) => Promise<void>;
  acceptTask: (id: string) => Promise<void>;
  declineTask: (id: string, reason: string) => Promise<void>;
  markTaskDone: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTasksByTeacher: (teacherId: string) => TeacherTask[];
}

const TeacherTasksContext = createContext<TeacherTasksContextType | null>(null);

export function TeacherTasksProvider({ children }: { children: ReactNode }) {
  const { profile } = useMyProfile();
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
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

    supabase
      .from("teacher_tasks")
      .select("*, teacher:profiles!teacher_id(full_name)")
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load tasks. Please refresh and try again.");
          setTasks([]);
        } else {
          setTasks(
            ((data ?? []) as any[]).map((t: any) => ({
              id: t.id,
              teacherId: t.teacher_id,
              teacherName: t.teacher?.full_name ?? "Unknown teacher",
              title: t.title,
              description: t.description ?? undefined,
              dueDate: t.due_date ?? undefined,
              status: t.status,
              declineReason: t.decline_reason ?? undefined,
              assignedDate: t.created_at?.split("T")[0] ?? "",
            }))
          );
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  const addTask = useCallback(async (task: Omit<TeacherTask, "id" | "status" | "assignedDate">) => {
    if (!profile) return;
    const supabase = createClient();
    await supabase.from("teacher_tasks").insert({
      school_id: profile.school_id,
      teacher_id: task.teacherId,
      assigned_by: profile.id,
      title: task.title,
      description: task.description ?? null,
      due_date: task.dueDate ?? null,
    } as any);
    refetch();
  }, [profile, refetch]);

  const acceptTask = useCallback(async (id: string) => {
    const supabase = createClient();
    await (supabase.from("teacher_tasks") as any).update({ status: "accepted", decline_reason: null }).eq("id", id);
    refetch();
  }, [refetch]);

  const declineTask = useCallback(async (id: string, reason: string) => {
    const supabase = createClient();
    await (supabase.from("teacher_tasks") as any).update({ status: "declined", decline_reason: reason }).eq("id", id);
    refetch();
  }, [refetch]);

  const markTaskDone = useCallback(async (id: string) => {
    const supabase = createClient();
    await (supabase.from("teacher_tasks") as any).update({ status: "done" }).eq("id", id);
    refetch();
  }, [refetch]);

  const reopenTask = useCallback(async (id: string) => {
    const supabase = createClient();
    await (supabase.from("teacher_tasks") as any).update({ status: "accepted" }).eq("id", id);
    refetch();
  }, [refetch]);

  const deleteTask = useCallback(async (id: string) => {
    const supabase = createClient();
    await (supabase.from("teacher_tasks") as any).delete().eq("id", id);
    refetch();
  }, [refetch]);

  const getTasksByTeacher = useCallback(
    (teacherId: string) => tasks.filter((t) => t.teacherId === teacherId),
    [tasks]
  );

  return (
    <TeacherTasksContext.Provider
      value={{ tasks, loading, error, addTask, acceptTask, declineTask, markTaskDone, reopenTask, deleteTask, getTasksByTeacher }}
    >
      {children}
    </TeacherTasksContext.Provider>
  );
}

export function useTeacherTasks() {
  const ctx = useContext(TeacherTasksContext);
  if (!ctx) throw new Error("useTeacherTasks must be used within TeacherTasksProvider");
  return ctx;
}
