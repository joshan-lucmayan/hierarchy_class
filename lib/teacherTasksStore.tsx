"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface TeacherTask {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "done";
  assignedDate: string;
}

interface TeacherTasksContextType {
  tasks: TeacherTask[];
  addTask: (task: Omit<TeacherTask, "id" | "status" | "assignedDate">) => void;
  toggleTaskStatus: (id: string) => void;
  getTasksByTeacher: (teacherId: string) => TeacherTask[];
}

const TeacherTasksContext = createContext<TeacherTasksContextType | null>(null);

const MOCK_TASKS: TeacherTask[] = [
  {
    id: "task-1",
    teacherId: "t-001",
    teacherName: "Ms. Daniela Fernandez",
    title: "Submit Q4 science lab grades",
    description: "Encode grades for the energy transformation lab activity.",
    dueDate: "2026-08-10",
    status: "pending",
    assignedDate: "2026-08-05",
  },
];

export function TeacherTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TeacherTask[]>(MOCK_TASKS);

  const addTask = useCallback((task: Omit<TeacherTask, "id" | "status" | "assignedDate">) => {
    const newTask: TeacherTask = {
      ...task,
      id: `task-${Date.now()}`,
      status: "pending",
      assignedDate: new Date().toISOString().split("T")[0],
    };
    setTasks((prev) => [newTask, ...prev]);
  }, []);

  const toggleTaskStatus = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === "pending" ? "done" : "pending" } : t))
    );
  }, []);

  const getTasksByTeacher = useCallback(
    (teacherId: string) => tasks.filter((t) => t.teacherId === teacherId),
    [tasks]
  );

  return (
    <TeacherTasksContext.Provider value={{ tasks, addTask, toggleTaskStatus, getTasksByTeacher }}>
      {children}
    </TeacherTasksContext.Provider>
  );
}

export function useTeacherTasks() {
  const ctx = useContext(TeacherTasksContext);
  if (!ctx) throw new Error("useTeacherTasks must be used within TeacherTasksProvider");
  return ctx;
}
