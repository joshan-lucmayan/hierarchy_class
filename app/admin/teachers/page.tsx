"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconUser, IconPlus, IconCheck, IconTask, IconPost, IconCalendar } from "@/components/ui/icons";
import type { ProfileRow } from "@/types/supabase";

/** Theme-safe task status chip mapping. */
function taskChip(status: string) {
  switch (status) {
    case "done":
      return { variant: "success" as const, label: "Done" };
    case "accepted":
      return { variant: "accent" as const, label: "Accepted" };
    case "declined":
      return { variant: "danger" as const, label: "Declined" };
    default:
      return { variant: "neutral" as const, label: "Pending" };
  }
}

export default function AdminTeachersPage() {
  const { profiles: teachers, loading: teachersLoading, error: teachersError } = useSchoolProfiles({ role: "teacher" });
  const { tasks, getTasksByTeacher, addTask } = useTeacherTasks();
  const {
    courses,
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

  const selectedCourses = useMemo(
    () => (selectedTeacher ? getCoursesByTeacher(selectedTeacher.id) : []),
    [selectedTeacher, getCoursesByTeacher]
  );

  const selectedStudentCount = useMemo(() => {
    const ids = new Set<string>();
    selectedCourses.forEach((c) => getStudentsByCourse(c.id).forEach((s) => s.profileId && ids.add(s.profileId)));
    return ids.size;
  }, [selectedCourses, getStudentsByCourse]);

  const selectedSubmittedGrades = useMemo(
    () => (selectedTeacher ? gradeEntries.filter((g) => g.submittedBy === selectedTeacher.id) : []),
    [selectedTeacher, gradeEntries]
  );

  const selectedPendingGrades = useMemo(
    () => selectedSubmittedGrades.filter((g) => g.approvalStatus === "pending").length,
    [selectedSubmittedGrades]
  );

  const recentActivity = useMemo(
    () => [...selectedSubmittedGrades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [selectedSubmittedGrades]
  );

  const selectedTasks = selectedTeacher ? getTasksByTeacher(selectedTeacher.id) : [];
  const pendingByTeacher = (teacherId: string) => getTasksByTeacher(teacherId).filter((t) => t.status === "pending").length;

  // School-wide workload snapshot, computed from the same live data the rows use.
  const snapshot = useMemo(() => {
    const assigned = courses.filter((c) => c.teacherId);
    return {
      assignedCourses: assigned.length,
      classes: new Set(assigned.map((c) => c.sectionId)).size,
      pendingTasks: tasks.filter((t) => t.status === "pending").length,
      pendingGrades: gradeEntries.filter((g) => g.approvalStatus === "pending").length,
    };
  }, [courses, tasks, gradeEntries]);

  function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacher || !taskDraft.title.trim()) return;
    addTask({ teacherId: selectedTeacher.id, teacherName: selectedTeacher.full_name, ...taskDraft });
    setTaskDraft({ title: "", description: "", dueDate: "" });
    setShowAssignForm(false);
  }

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Monitor teachers</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Teacher management · {teachers.length} registered
          </h2>
        </div>
        <Stat
          label="Pending grades"
          value={snapshot.pendingGrades}
          tone={snapshot.pendingGrades > 0 ? "warn" : "muted"}
          hint="Awaiting your review"
        />
      </div>

      {teachersError && (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{teachersError}</p>
      )}

      {teachersLoading ? (
        /* Skeleton: mirror the real two-column geometry. */
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <CornerFrame className="p-5">
            <div className="h-10 w-full animate-pulse rounded-[10px] bg-tile" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 rounded-[10px] border border-base p-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-tile" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded-full bg-tile" />
                    <div className="h-2.5 w-24 rounded-full bg-tile" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-tile" />
                </div>
              ))}
            </div>
          </CornerFrame>
          <CornerFrame className="p-5">
            <div className="flex animate-pulse items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-full bg-tile" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded-full bg-tile" />
                <div className="h-3 w-64 rounded-full bg-tile" />
              </div>
            </div>
            <div className="mt-5 grid animate-pulse grid-cols-3 gap-3">
              <div className="h-20 rounded-[8px] bg-tile" />
              <div className="h-20 rounded-[8px] bg-tile" />
              <div className="h-20 rounded-[8px] bg-tile" />
            </div>
            <div className="mt-5 h-32 animate-pulse rounded-[10px] bg-tile" />
            <div className="mt-4 h-40 animate-pulse rounded-[10px] bg-tile" />
          </CornerFrame>
        </div>
      ) : teachers.length === 0 ? (
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconUser size={16} />}
            title="No teachers yet"
            desc="Teachers appear here as soon as they sign up and are verified in your school."
          />
        </CornerFrame>
      ) : (
        <>
          {/* ========================================================== */}
          {/* BAND 1 - TEACHING WORKFORCE SNAPSHOT                    */}
          {/* ========================================================== */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Teachers" value={teachers.length} tone="default" hint="Signed up in this school" />
            <Stat label="Assigned courses" value={snapshot.assignedCourses} tone="accent" hint="Courses with a teacher" />
            <Stat label="Classes" value={snapshot.classes} tone="default" hint="Distinct sections covered" />
            <Stat
              label="Pending tasks"
              value={snapshot.pendingTasks}
              tone={snapshot.pendingTasks > 0 ? "warn" : "muted"}
              hint="Awaiting teacher action"
            />
          </section>

          {/* ========================================================== */}
          {/* BAND 2 - DIRECTORY / DETAIL                              */}
          {/* ========================================================== */}
          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            {/* Roster */}
            <CornerFrame className="p-5">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search teachers..."
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 pr-16 text-sm text-navy outline-none focus:border-accent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
                  {filtered.length}
                </span>
              </div>

              <div className="mt-4 max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <div className="py-6">
                    <EmptyState
                      icon={<IconUser size={16} />}
                      title="No teachers found"
                      desc="No teachers match the current search. Try a name or favorite subject."
                    />
                    {query && (
                      <div className="mt-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                          Clear search
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  filtered.map((teacher) => {
                    const tCourses = getCoursesByTeacher(teacher.id);
                    const courseCount = tCourses.length;
                    const classCount = new Set(tCourses.map((c) => c.sectionId)).size;
                    const pending = pendingByTeacher(teacher.id);
                    return (
                      <button
                        type="button"
                        key={teacher.id}
                        onClick={() => { setSelectedId(teacher.id); setShowAssignForm(false); }}
                        className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition ${
                          selectedTeacher?.id === teacher.id
                            ? "border-accent-token bg-[var(--surface-strong)]"
                            : "border-base bg-surface hover:border-accent-soft"
                        }`}
                      >
                        <UserAvatar name={teacher.full_name} src={teacher.avatar_url} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy">{teacher.full_name}</p>
                          <p className="truncate text-[11px] text-muted">
                            {courseCount > 0
                              ? `${courseCount} course${courseCount === 1 ? "" : "s"} · ${classCount} class${classCount === 1 ? "" : "es"}`
                              : "No courses assigned"}
                          </p>
                        </div>
                        {pending > 0 && <Chip variant="warn">{pending} pending</Chip>}
                      </button>
                    );
                  })
                )}
              </div>
            </CornerFrame>

            {/* Detail */}
            <CornerFrame className="p-5">
              {!selectedTeacher ? (
                <div className="py-10">
                  <EmptyState
                    icon={<IconUser size={16} />}
                    title="Select a teacher"
                    desc="Pick a teacher from the roster to view their courses, students, grading activity, and assigned tasks."
                  />
                </div>
              ) : (
                <>
                  {/* Identity */}
                  <div className="flex flex-wrap items-center gap-4">
                    <UserAvatar
                      name={selectedTeacher.full_name}
                      src={selectedTeacher.avatar_url}
                      size="xl"
                      className="!border-2 !border-accent-token"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-navy">{selectedTeacher.full_name}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {selectedCourses.length > 0 ? (
                          <>Teaches: {selectedCourses.map((c) => c.name).join(" · ")}</>
                        ) : (
                          "No courses assigned yet"
                        )}
                      </p>
                      {selectedTeacher.bio && <p className="mt-1 text-xs text-muted">{selectedTeacher.bio}</p>}
                    </div>
                    {selectedPendingGrades > 0 && (
                      <Chip variant="warn">{selectedPendingGrades} pending grades</Chip>
                    )}
                  </div>

                  {/* Stat strip */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <Stat label="Courses" value={selectedCourses.length} />
                    <Stat label="Students" value={selectedStudentCount} />
                    <Stat label="Grades submitted" value={selectedSubmittedGrades.length} />
                  </div>

                  {/* Assigned courses */}
                  <div className="mt-6">
                    <h3 className="section-label">Assigned courses</h3>
                    <div className="mt-3 space-y-1.5">
                      {selectedCourses.length === 0 ? (
                        <div className="py-2">
                          <EmptyState
                            icon={<IconPost size={16} />}
                            title="No courses assigned"
                            desc="Assign this teacher to a course from the academic hierarchy to get started."
                          />
                        </div>
                      ) : (
                        selectedCourses.map((c) => {
                          const entries = getEntriesByCourse(c.id);
                          const avg = entries.length > 0
                            ? Math.round((entries.reduce((a, e) => a + e.score, 0) / entries.length) * 10) / 10
                            : null;
                          return (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-3 rounded-[10px] border border-base px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm text-navy">
                                  {c.name}
                                  {c.code ? <span className="text-faint"> · {c.code}</span> : null}
                                </p>
                                <p className="truncate text-xs text-muted">
                                  {sectionName(c.sectionId)} · {getStudentsByCourse(c.id).length} students
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-bold text-accent-token">{avg ?? "-"}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Recent grading activity */}
                  <div className="mt-6">
                    <h3 className="section-label">Recent grading activity</h3>
                    <div className="mt-3 space-y-1.5">
                      {recentActivity.length === 0 ? (
                        <div className="py-2">
                          <EmptyState
                            icon={<IconCheck size={16} />}
                            title="No grades submitted"
                            desc="This teacher hasn't submitted grades yet."
                          />
                        </div>
                      ) : (
                        recentActivity.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center justify-between gap-3 rounded-[10px] border border-base px-3 py-2"
                          >
                            <p className="min-w-0 truncate text-sm text-navy">{g.label ?? g.type}</p>
                            <div className="flex shrink-0 items-center gap-2">
                              <p className="text-sm font-bold text-accent-token">{g.score}</p>
                              <span className="text-xs text-muted">{g.date}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Assigned tasks */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="section-label">Assigned tasks</h3>
                      <Button
                        variant={showAssignForm ? "outline" : "ghost"}
                        size="sm"
                        icon={<IconPlus size={13} />}
                        onClick={() => setShowAssignForm(!showAssignForm)}
                      >
                        {showAssignForm ? "Cancel" : "Assign task"}
                      </Button>
                    </div>

                    {showAssignForm && (
                      <form
                        onSubmit={handleAssign}
                        className="mt-3 space-y-2 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4"
                      >
                        <input
                          value={taskDraft.title}
                          onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                          placeholder="Task title"
                          className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
                        />
                        <textarea
                          value={taskDraft.description}
                          onChange={(e) => setTaskDraft((d) => ({ ...d, description: e.target.value }))}
                          placeholder="Description (optional)"
                          rows={2}
                          className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
                        />
                        <input
                          type="date"
                          value={taskDraft.dueDate}
                          onChange={(e) => setTaskDraft((d) => ({ ...d, dueDate: e.target.value }))}
                          className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
                        />
                        <Button type="submit" variant="accent" className="w-full justify-center" icon={<IconCheck size={14} />}>
                          Assign
                        </Button>
                      </form>
                    )}

                    <div className="mt-3 space-y-1.5">
                      {selectedTasks.length === 0 ? (
                        <div className="py-2">
                          <EmptyState
                            icon={<IconTask size={16} />}
                            title="No tasks assigned"
                            desc="Assign a task so this teacher knows what needs their attention."
                          />
                        </div>
                      ) : (
                        selectedTasks.map((t) => {
                          const chip = taskChip(t.status);
                          return (
                            <div key={t.id} className="rounded-[10px] border border-base px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-navy">{t.title}</p>
                                  {t.dueDate && (
                                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                                      <IconCalendar size={10} /> Due {t.dueDate}
                                    </p>
                                  )}
                                </div>
                                <Chip variant={chip.variant}>{chip.label}</Chip>
                              </div>
                              {t.status === "declined" && t.declineReason && (
                                <p className="mt-1 text-[11px] text-warn">Reason: {t.declineReason}</p>
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
        </>
      )}
    </div>
  );
}
