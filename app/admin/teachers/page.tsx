"use client";

import { useState } from "react";
import { TEACHER_DIRECTORY } from "@/data/mockStudents";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { CornerFrame } from "@/components/ui/CornerFrame";

export default function AdminTeachersPage() {
  const { getTasksByTeacher, addTask } = useTeacherTasks();
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState({ title: "", description: "", dueDate: "" });

  function openAssign(teacherId: string) {
    setAssigningTo(assigningTo === teacherId ? null : teacherId);
    setTaskDraft({ title: "", description: "", dueDate: "" });
  }

  function handleAssign(e: React.FormEvent, teacherId: string, teacherName: string) {
    e.preventDefault();
    if (!taskDraft.title.trim()) return;
    addTask({ teacherId, teacherName, ...taskDraft });
    setAssigningTo(null);
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher Performance</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Monitor teachers</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Review each teacher's activity and assign tasks directly from here.
        </p>
      </CornerFrame>

      <div className="grid gap-4 xl:grid-cols-2">
        {TEACHER_DIRECTORY.map((teacher) => {
          const tasks = getTasksByTeacher(teacher.id);
          const pendingCount = tasks.filter((t) => t.status === "pending").length;

          return (
            <CornerFrame key={teacher.id} className="rounded-3xl border border-base bg-surface p-6 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-gold bg-navy text-sm font-bold text-gold">
                    {teacher.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">{teacher.name}</p>
                    <p className="text-xs text-muted">{teacher.subject} · {teacher.office}</p>
                  </div>
                </div>
                {pendingCount > 0 && (
                  <span className="shrink-0 rounded-full bg-gold/20 px-3 py-1 text-[11px] font-semibold text-gold">
                    {pendingCount} pending task{pendingCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <p className="mt-3 text-xs text-muted">{teacher.bio}</p>

              {tasks.length > 0 && (
                <div className="mt-4 space-y-2">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-2xl border border-base bg-[var(--surface-strong)] px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-navy">{t.title}</p>
                        {t.dueDate && <p className="text-[10px] text-muted">Due {t.dueDate}</p>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.status === "done" ? "bg-emerald-500/15 text-emerald-600" : "bg-gold/20 text-gold"
                      }`}>
                        {t.status === "done" ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => openAssign(teacher.id)}
                className="mt-4 w-full rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
              >
                {assigningTo === teacher.id ? "Cancel" : "+ Assign task"}
              </button>

              {assigningTo === teacher.id && (
                <form
                  onSubmit={(e) => handleAssign(e, teacher.id, teacher.name)}
                  className="mt-3 space-y-2 rounded-2xl border border-base bg-[var(--surface-strong)] p-4"
                >
                  <input
                    value={taskDraft.title}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Task title"
                    className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                  <textarea
                    value={taskDraft.description}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                  <input
                    type="date"
                    value={taskDraft.dueDate}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, dueDate: e.target.value }))}
                    className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                  <button type="submit" className="w-full rounded-lg bg-navy py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-navy">
                    Assign
                  </button>
                </form>
              )}
            </CornerFrame>
          );
        })}
      </div>
    </div>
  );
}
