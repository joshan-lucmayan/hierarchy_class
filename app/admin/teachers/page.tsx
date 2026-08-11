"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";
import type { ProfileRow } from "@/types/supabase";

export default function AdminTeachersPage() {
  const { profiles: teachers, loading: teachersLoading, error: teachersError } = useSchoolProfiles({ role: "teacher" });
  const { getTasksByTeacher, addTask } = useTeacherTasks();
  const {
    sections,
    getCoursesByTeacher,
    getStudentsByCourse,
    getEntriesByCourse,
    gradeEntries,
  } = useClassroomHierarchy();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [taskDraft, setTaskDraft] = useState({ title: "", description: "", dueDate: "" });

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return teachers.filter(
      (t) => t.full_name.toLowerCase().includes(q) || (t.favorite_subject ?? "").toLowerCase().includes(q)
    );
  }, [teachers, query]);

  const selectedTeacher: ProfileRow | undefined = filtered.find((t) => t.id === selectedId) ?? filtered[0];

  const sectionName = (sectionId: string) => sections.find((s) => s.id === sectionId)?.name ?? "";

  const selectedCourses = selectedTeacher ? getCoursesByTeacher(selectedTeacher.id) : [];

  const selectedStudentCount = useMemo(() => {
    const ids = new Set<string>();
    selectedCourses.forEach((c) => getStudentsByCourse(c.id).forEach((s) => s.profileId && ids.add(s.profileId)));
    return ids.size;
  }, [selectedCourses, getStudentsByCourse]);

  const selectedSubmittedGrades = useMemo(
    () => (selectedTeacher ? gradeEntries.filter((g) => g.submittedBy === selectedTeacher.id) : []),
    [selectedTeacher, gradeEntries]
  );

  const recentActivity = useMemo(
    () => [...selectedSubmittedGrades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [selectedSubmittedGrades]
  );

  const selectedTasks = selectedTeacher ? getTasksByTeacher(selectedTeacher.id) : [];
  const pendingByTeacher = (teacherId: string) => getTasksByTeacher(teacherId).filter((t) => t.status === "pending").length;

  function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacher || !taskDraft.title.trim()) return;
    addTask({ teacherId: selectedTeacher.id, teacherName: selectedTeacher.full_name, ...taskDraft });
    setTaskDraft({ title: "", description: "", dueDate: "" });
    setShowAssignForm(false);
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher Performance</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Monitor teachers</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Every real signed-up teacher, with the courses, students, and grading activity they actually own.
        </p>
      </CornerFrame>

      {teachersLoading && <p className="text-sm text-muted">Loading teachers...</p>}
      {teachersError && <p className="text-sm text-red-500">{teachersError}</p>}

      {!teachersLoading && !teachersError && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-navy outline-none"
            />
            <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-sm text-muted">No teachers match your search.</p>
              ) : (
                filtered.map((teacher) => {
                  const courseCount = getCoursesByTeacher(teacher.id).length;
                  const pending = pendingByTeacher(teacher.id);
                  return (
                    <button
                      type="button"
                      key={teacher.id}
                      onClick={() => { setSelectedId(teacher.id); setShowAssignForm(false); }}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        selectedTeacher?.id === teacher.id
                          ? "border-gold bg-[var(--surface-strong)]"
                          : "border-base bg-surface hover:border-gold"
                      }`}
                    >
                      <img
                        src={teacher.avatar_url || "/avatars/default-avatar.webp"}
                        alt={teacher.full_name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">{teacher.full_name}</p>
                        <p className="truncate text-xs text-muted">
                          {courseCount} course{courseCount === 1 ? "" : "s"} assigned
                        </p>
                      </div>
                      {pending > 0 && (
                        <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">
                          {pending} pending
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            {!selectedTeacher ? (
              <p className="text-sm text-muted">Select a teacher from the roster to see details.</p>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <img
                    src={selectedTeacher.avatar_url || "/avatars/default-avatar.webp"}
                    alt={selectedTeacher.full_name}
                    className="h-16 w-16 rounded-full border-2 border-gold object-cover"
                  />
                  <div>
                    <p className="text-lg font-semibold text-navy">{selectedTeacher.full_name}</p>
                    {selectedCourses.length > 0 ? (
                      <p className="text-xs text-muted">
                        Teaches:{" "}
                        {selectedCourses.map((c) => c.name).join(" · ")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted">No courses assigned yet</p>
                    )}
                    {selectedTeacher.bio && <p className="mt-1 text-xs text-muted">{selectedTeacher.bio}</p>}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-3 text-center">
                    <p className="text-xl font-bold text-navy">{selectedCourses.length}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">Courses</p>
                  </div>
                  <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-3 text-center">
                    <p className="text-xl font-bold text-navy">{selectedStudentCount}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">Students</p>
                  </div>
                  <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-3 text-center">
                    <p className="text-xl font-bold text-navy">{selectedSubmittedGrades.length}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">Grades submitted</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Assigned courses</p>
                  <div className="mt-3 space-y-2">
                    {selectedCourses.length === 0 ? (
                      <p className="text-sm text-muted">No courses assigned yet.</p>
                    ) : (
                      selectedCourses.map((c) => {
                        const entries = getEntriesByCourse(c.id);
                        const avg = entries.length > 0
                          ? Math.round((entries.reduce((a, e) => a + e.score, 0) / entries.length) * 10) / 10
                          : null;
                        return (
                          <div key={c.id} className="flex items-center justify-between rounded-xl border border-base px-3 py-2">
                            <div>
                              <p className="text-sm text-navy">{c.name}</p>
                              <p className="text-xs text-muted">{sectionName(c.sectionId)} · {getStudentsByCourse(c.id).length} students</p>
                            </div>
                            <p className="text-sm font-bold text-gold">{avg ?? "--"}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Recent grading activity</p>
                  <div className="mt-3 space-y-2">
                    {recentActivity.length === 0 ? (
                      <p className="text-sm text-muted">No grades submitted yet.</p>
                    ) : (
                      recentActivity.map((g) => (
                        <div key={g.id} className="flex items-center justify-between rounded-xl border border-base px-3 py-2">
                          <p className="text-sm text-navy">{g.label ?? g.type}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gold">{g.score}</p>
                            <span className="text-xs text-muted">{g.date}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Assigned tasks</p>
                    <button
                      type="button"
                      onClick={() => setShowAssignForm(!showAssignForm)}
                      className="rounded-full border border-base bg-surface px-3 py-1 text-xs font-semibold text-navy transition hover:border-gold"
                    >
                      {showAssignForm ? "Cancel" : "+ Assign task"}
                    </button>
                  </div>

                  {showAssignForm && (
                    <form onSubmit={handleAssign} className="mt-3 space-y-2 rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
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

                  <div className="mt-3 space-y-2">
                    {selectedTasks.length === 0 ? (
                      <p className="text-sm text-muted">No tasks assigned yet.</p>
                    ) : (
                      selectedTasks.map((t) => {
                        const statusStyle =
                          t.status === "done" ? "bg-emerald-500/15 text-emerald-600" :
                          t.status === "accepted" ? "bg-blue-500/15 text-blue-600" :
                          t.status === "declined" ? "bg-red-500/15 text-red-600" :
                          "bg-gold/20 text-gold";
                        const statusLabel =
                          t.status === "done" ? "Done" :
                          t.status === "accepted" ? "Accepted" :
                          t.status === "declined" ? "Declined" :
                          "Pending";
                        return (
                          <div key={t.id} className="rounded-xl border border-base px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-navy">{t.title}</p>
                                {t.dueDate && <p className="text-[10px] text-muted">Due {t.dueDate}</p>}
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle}`}>
                                {statusLabel}
                              </span>
                            </div>
                            {t.status === "declined" && t.declineReason && (
                              <p className="mt-1 text-[11px] text-red-500">Reason: {t.declineReason}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </CornerFrame>
        </section>
      )}
    </div>
  );
}
