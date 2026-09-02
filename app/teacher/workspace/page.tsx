"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMyProfile } from "@/lib/useMyProfile";
import {
  useTeacherWorkspace,
  ScheduleItem,
  LessonPlanItem,
  TeacherNote,
} from "@/lib/teacherWorkspaceStore";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import {
  todayDayName,
  formatDisplayDate,
  todayDateInput,
  nowHHMM,
  formatTimeLabel,
  useNow,
} from "@/lib/teacherDayUtils";
import { toISODate } from "@/lib/weekUtils";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskItem } from "@/components/teacher/TaskItem";
import {
  IconCalendar,
  IconCompose,
  IconPencil,
  IconTask,
  IconPost,
  IconPlus,
  IconX,
  IconCheck,
  IconSearch,
  IconChevronRight,
} from "@/components/ui/icons";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type Tool = "overview" | "notes" | "schedule" | "lessons" | "tasks";

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <IconPost size={15} /> },
  { id: "notes", label: "Notes", icon: <IconPencil size={15} /> },
  { id: "schedule", label: "Schedule", icon: <IconCalendar size={15} /> },
  { id: "lessons", label: "Lesson Plans", icon: <IconCompose size={15} /> },
  { id: "tasks", label: "Tasks", icon: <IconTask size={15} /> },
];

/** Skeleton block - the app's pulse loading language. */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-tile ${className}`} />;
}

/** Filter pill row shared by the lesson/task tools. */
function FilterPills<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { id: T; label: string; count: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isActive = opt.id === active;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              isActive
                ? "border border-accent-soft bg-accent-soft text-accent-token"
                : "border border-base bg-surface text-muted hover:bg-tile hover:text-navy"
            }`}
          >
            {opt.label}
            <span className={isActive ? "text-accent-token" : "text-faint"}>{opt.count}</span>
          </button>
        );
      })}
    </div>
  );
}

const TOOL_IDS: Tool[] = TOOLS.map((t) => t.id);

function TeacherWorkspaceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useMyProfile();
  const {
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
    loading: workspaceLoading,
    error: workspaceError,
  } = useTeacherWorkspace();
  const { getTasksByTeacher, acceptTask, declineTask, markTaskDone, reopenTask, deleteTask } = useTeacherTasks();

  const [tool, setTool] = useState<Tool>(() => {
    const param = searchParams.get("tool");
    return TOOL_IDS.includes(param as Tool) ? (param as Tool) : "overview";
  });

  function selectTool(next: Tool) {
    setTool(next);
    // Keep the tool in the URL so Home projections and refreshes land on the
    // right Workspace surface (replace - never push history entries).
    router.replace(`/teacher/workspace?tool=${next}`, { scroll: false });
  }

  const now = useNow();
  const today = todayDayName(now);
  const todayStr = todayDateInput(now);
  const currentHHMM = nowHHMM(now);

  const assignedTasks = useMemo(
    () => (profile ? getTasksByTeacher(profile.id) : []),
    [profile, getTasksByTeacher]
  );

  // --- Overview projections (same rules as Teacher Home - no extra queries) ---
  const todaySchedule = useMemo(
    () =>
      scheduleItems
        .filter((s) => s.day === today && s.endTime >= currentHHMM)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [scheduleItems, today, currentHHMM]
  );
  const todayLessonPlans = useMemo(
    () =>
      lessonPlans
        .filter((l) => l.date === todayStr && (!l.endTime || l.endTime >= currentHHMM))
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [lessonPlans, todayStr, currentHHMM]
  );
  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const pendingTaskCount = useMemo(() => assignedTasks.filter((t) => t.status === "pending").length, [assignedTasks]);
  const overdueTasks = useMemo(
    () =>
      assignedTasks.filter(
        (t) => t.status !== "done" && t.status !== "declined" && !!t.dueDate && t.dueDate < toISODate(new Date())
      ),
    [assignedTasks]
  );

  // --- Notes tool ---
  const [noteQuery, setNoteQuery] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEditDraft, setNoteEditDraft] = useState("");

  const filteredNotes = useMemo(() => {
    const q = noteQuery.trim().toLowerCase();
    const list = q ? notes.filter((n) => n.text.toLowerCase().includes(q)) : notes;
    return [...list].sort((a, b) =>
      a.pinned === b.pinned ? b.createdAt.localeCompare(a.createdAt) : a.pinned ? -1 : 1
    );
  }, [notes, noteQuery]);

  // --- Schedule tool ---
  const [scheduleDraft, setScheduleDraft] = useState({ day: DAYS[0], startTime: "", endTime: "", subject: "" });
  const [scheduleFormError, setScheduleFormError] = useState("");

  const scheduleByDay = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    for (const day of DAYS) map[day] = [];
    for (const item of scheduleItems) {
      if (map[item.day]) map[item.day].push(item);
    }
    for (const day of DAYS) map[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [scheduleItems]);

  // --- Lesson Plans tool ---
  type LessonFilter = "all" | "upcoming" | "past";
  const [lessonFilter, setLessonFilter] = useState<LessonFilter>("all");
  const [lessonDraft, setLessonDraft] = useState({ title: "", date: "", startTime: "", endTime: "", description: "" });
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonEditDraft, setLessonEditDraft] = useState({ title: "", date: "", startTime: "", endTime: "", description: "" });

  const lessonGroups = useMemo(() => {
    const sorted = [...lessonPlans].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || "")
    );
    return {
      upcoming: sorted.filter((p) => p.date >= todayStr),
      past: sorted.filter((p) => p.date < todayStr).reverse(),
    };
  }, [lessonPlans, todayStr]);

  // --- Tasks tool ---
  type TaskFilter = "all" | "pending" | "accepted" | "done" | "declined";
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const filteredTasks = taskFilter === "all" ? assignedTasks : assignedTasks.filter((t) => t.status === taskFilter);

  function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleDraft.subject.trim() || !scheduleDraft.startTime || !scheduleDraft.endTime) return;
    if (scheduleDraft.endTime <= scheduleDraft.startTime) {
      setScheduleFormError("End time must be after start time.");
      return;
    }
    setScheduleFormError("");
    addScheduleItem(scheduleDraft);
    setScheduleDraft({ day: DAYS[0], startTime: "", endTime: "", subject: "" });
  }

  function handleAddLessonPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonDraft.title.trim()) return;
    addLessonPlan(lessonDraft);
    setLessonDraft({ title: "", description: "", date: "", startTime: "", endTime: "" });
  }

  function startEditLesson(plan: LessonPlanItem) {
    setEditingLessonId(plan.id);
    setLessonEditDraft({ title: plan.title, date: plan.date, startTime: plan.startTime, endTime: plan.endTime, description: plan.description });
  }

  function saveEditLesson() {
    if (!editingLessonId) return;
    if (!lessonEditDraft.title.trim()) return;
    updateLessonPlan(editingLessonId, lessonEditDraft);
    setEditingLessonId(null);
  }

  function startEditNote(note: TeacherNote) {
    setEditingNoteId(note.id);
    setNoteEditDraft(note.text);
  }

  function saveEditNote() {
    if (!editingNoteId) return;
    if (!noteEditDraft.trim()) return;
    updateNote(editingNoteId, noteEditDraft);
    setEditingNoteId(null);
  }

  const filterPills: { id: TaskFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: assignedTasks.length },
    { id: "pending", label: "Pending", count: assignedTasks.filter((t) => t.status === "pending").length },
    { id: "accepted", label: "Accepted", count: assignedTasks.filter((t) => t.status === "accepted").length },
    { id: "done", label: "Done", count: assignedTasks.filter((t) => t.status === "done").length },
    { id: "declined", label: "Declined", count: assignedTasks.filter((t) => t.status === "declined").length },
  ];

  const lessonFilterPills: { id: LessonFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: lessonPlans.length },
    { id: "upcoming", label: "Upcoming", count: lessonGroups.upcoming.length },
    { id: "past", label: "Past", count: lessonGroups.past.length },
  ];


  const inputClass =
    "w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-accent";

  /** Lesson plan row with inline edit support. */
  function renderLessonRow(plan: LessonPlanItem) {
    if (editingLessonId === plan.id) {
      return (
        <div key={plan.id} className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_180px_140px_140px]">
            <input
              value={lessonEditDraft.title}
              onChange={(e) => setLessonEditDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Lesson title"
              className={inputClass}
              autoFocus
            />
            <input
              type="date"
              value={lessonEditDraft.date}
              onChange={(e) => setLessonEditDraft((d) => ({ ...d, date: e.target.value }))}
              className={inputClass}
            />
            <input
              type="time"
              value={lessonEditDraft.startTime}
              onChange={(e) => setLessonEditDraft((d) => ({ ...d, startTime: e.target.value }))}
              aria-label="Start time (optional)"
              className={inputClass}
            />
            <input
              type="time"
              value={lessonEditDraft.endTime}
              onChange={(e) => setLessonEditDraft((d) => ({ ...d, endTime: e.target.value }))}
              aria-label="End time (optional)"
              className={inputClass}
            />
          </div>
          <textarea
            value={lessonEditDraft.description}
            onChange={(e) => setLessonEditDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="What will you cover?"
            rows={2}
            className={`${inputClass} mt-2`}
          />
          <div className="mt-2 flex gap-2">
            <Button variant="accent" size="sm" icon={<IconCheck size={12} />} onClick={saveEditLesson} disabled={!lessonEditDraft.title.trim()}>
              Save changes
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditingLessonId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div key={plan.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-base p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy">{plan.title}</p>
          <p className="text-xs text-accent-token">
            {plan.date}
            {plan.startTime && plan.endTime ? ` · ${formatTimeLabel(plan.startTime)} - ${formatTimeLabel(plan.endTime)}` : ""}
          </p>
          {plan.description && <p className="mt-1 text-xs text-muted">{plan.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => startEditLesson(plan)}
            aria-label="Edit lesson plan"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-tile hover:text-navy"
          >
            <IconPencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => removeLessonPlan(plan.id)}
            aria-label="Delete lesson plan"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-tile hover:text-warn"
          >
            <IconX size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* HEADER                                                      */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Workspace</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Your work desk · {todayDayName(now)}, {formatDisplayDate(now)}
          </h2>
        </div>
        {pinnedNotes.length > 0 && (
          <Chip variant="accent">{pinnedNotes.length} pinned note{pinnedNotes.length === 1 ? "" : "s"}</Chip>
        )}
      </div>

      {workspaceError && (
        <p className="rounded-[8px] border border-warn-soft bg-warn-soft px-3 py-2 text-xs text-warn">
          {workspaceError}
        </p>
      )}

      {/* ============================================================ */}
      {/* RAIL + CONTENT                                              */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Workspace rail - vertical on desktop, horizontal scroll on mobile. */}
        <nav
          aria-label="Workspace tools"
          className="flex shrink-0 gap-1 overflow-x-auto pb-1 lg:w-44 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {TOOLS.map((t) => {
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTool(t.id)}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-3 py-2 text-[12.5px] font-semibold transition ${
                  active
                    ? "border border-accent-soft bg-accent-soft text-accent-token"
                    : "border border-transparent text-muted hover:bg-tile hover:text-navy"
                }`}
              >
                <span className={active ? "text-accent-token" : "text-faint"}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {workspaceLoading ? (
            /* Geometry-matching skeleton while the workspace store loads. */
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-[10px] border border-base bg-surface p-5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="mt-4 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : tool === "overview" ? (
            /* OVERVIEW - the work desk */
            <div className="grid gap-4 md:grid-cols-2">
              <CornerFrame className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-label">Today&apos;s schedule</h2>
                  <Chip variant="accent">{todaySchedule.length} remaining</Chip>
                </div>
                <div className="mt-4 space-y-2">
                  {todaySchedule.length === 0 ? (
                    <EmptyState icon={<IconCalendar />} title="Nothing left today" desc="Upcoming classes for today will appear here." />
                  ) : (
                    todaySchedule.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-[8px] border border-line bg-tile px-3 py-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-sealion" />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-navy">{item.subject}</span>
                        <span className="shrink-0 text-[11px] text-muted">
                          {formatTimeLabel(item.startTime)} - {formatTimeLabel(item.endTime)}
                        </span>
                      </div>
                    ))
                  )}
                  {todaySchedule.length > 3 && (
                    <p className="text-[11px] text-muted">+{todaySchedule.length - 3} more class{ todaySchedule.length - 3 === 1 ? "" : "es"} today</p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-4" icon={<IconChevronRight size={12} />} onClick={() => setTool("schedule")}>
                  Open schedule
                </Button>
              </CornerFrame>

              <CornerFrame className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-label">Today&apos;s lesson plans</h2>
                  <Chip variant="accent">{todayLessonPlans.length} today</Chip>
                </div>
                <div className="mt-4 space-y-2">
                  {todayLessonPlans.length === 0 ? (
                    <EmptyState icon={<IconCompose />} title="No lesson plans today" desc="Plans you create for today will appear here." />
                  ) : (
                    todayLessonPlans.slice(0, 3).map((plan) => (
                      <div key={plan.id} className="rounded-[8px] border border-line bg-tile px-3 py-2">
                        <p className="truncate text-[12.5px] font-semibold text-navy">{plan.title}</p>
                        {plan.startTime && plan.endTime && (
                          <p className="text-[11px] text-accent-token">{formatTimeLabel(plan.startTime)} - {formatTimeLabel(plan.endTime)}</p>
                        )}
                      </div>
                    ))
                  )}
                  {todayLessonPlans.length > 3 && (
                    <p className="text-[11px] text-muted">+{todayLessonPlans.length - 3} more plan{ todayLessonPlans.length - 3 === 1 ? "" : "s"} today</p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-4" icon={<IconChevronRight size={12} />} onClick={() => setTool("lessons")}>
                  Open lesson plans
                </Button>
              </CornerFrame>

              <CornerFrame className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="section-label">Pinned notes</h2>
                  <Chip>{pinnedNotes.length} pinned</Chip>
                </div>
                <div className="mt-4 space-y-2">
                  {pinnedNotes.length === 0 ? (
                    <EmptyState icon={<IconPencil />} title="No pinned notes" desc="Pin a note from the Notes tool to keep it close." />
                  ) : (
                    pinnedNotes.slice(0, 3).map((note) => (
                      <div key={note.id} className="rounded-[8px] border border-accent-soft bg-[var(--surface-strong)] px-3 py-2">
                        <p className="line-clamp-2 text-[12.5px] text-navy">{note.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-4" icon={<IconChevronRight size={12} />} onClick={() => setTool("notes")}>
                  Open notes
                </Button>
              </CornerFrame>

              <CornerFrame className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="section-label">Tasks</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingTaskCount > 0 && <Chip variant="warn">{pendingTaskCount} pending</Chip>}
                    {overdueTasks.length > 0 && <Chip variant="danger">{overdueTasks.length} overdue</Chip>}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {pendingTaskCount === 0 && overdueTasks.length === 0 ? (
                    <EmptyState icon={<IconTask />} title="All clear" desc="No tasks are waiting on you right now." />
                  ) : (
                    assignedTasks
                      .filter((t) => t.status === "pending" || overdueTasks.some((o) => o.id === t.id))
                      .slice(0, 3)
                      .map((task) => (
                        <div key={task.id} className="rounded-[8px] border border-line bg-tile px-3 py-2">
                          <p className="truncate text-[12.5px] font-semibold text-navy">{task.title}</p>
                          <p className="text-[11px] text-muted">
                            {task.status === "pending" ? "Waiting for your decision" : `Due ${task.dueDate ?? "-"}`}
                          </p>
                        </div>
                      ))
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-4" icon={<IconChevronRight size={12} />} onClick={() => setTool("tasks")}>
                  Open tasks
                </Button>
              </CornerFrame>
            </div>
          ) : tool === "notes" ? (
            /* NOTES */
            <div className="space-y-4">
              <CornerFrame className="p-5">
                <h2 className="section-label">Quick note</h2>
                <form onSubmit={(e) => { e.preventDefault(); addNote(noteDraft); setNoteDraft(""); }} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Jot something down..."
                    rows={2}
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <Button type="submit" variant="accent" icon={<IconPlus size={13} />} disabled={!noteDraft.trim()}>
                    Add note
                  </Button>
                </form>
              </CornerFrame>

              <CornerFrame className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="section-label">All notes</h2>
                  <Chip>{filteredNotes.length} of {notes.length}</Chip>
                </div>
                <div className="relative mt-3">
                  <IconSearch size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    value={noteQuery}
                    onChange={(e) => setNoteQuery(e.target.value)}
                    placeholder="Search notes..."
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {filteredNotes.length === 0 ? (
                    <EmptyState
                      icon={<IconPencil />}
                      title={noteQuery.trim() ? "No matching notes" : "No notes yet"}
                      desc={noteQuery.trim() ? "Try a different search." : "Notes you add will appear here."}
                    />
                  ) : (
                    filteredNotes.map((note) =>
                      editingNoteId === note.id ? (
                        <div key={note.id} className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
                          <textarea
                            value={noteEditDraft}
                            onChange={(e) => setNoteEditDraft(e.target.value)}
                            rows={2}
                            className={`${inputClass} w-full`}
                            autoFocus
                          />
                          <div className="mt-2 flex gap-2">
                            <Button variant="accent" size="sm" icon={<IconCheck size={12} />} onClick={saveEditNote} disabled={!noteEditDraft.trim()}>
                              Save
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingNoteId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div key={note.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-base p-3">
                          <div className="min-w-0 flex-1">
                            {note.pinned && <Chip variant="accent" className="mb-1.5">Pinned</Chip>}
                            <p className="whitespace-pre-wrap text-sm text-navy">{note.text}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePinNote(note.id)}
                              aria-label={note.pinned ? "Unpin note" : "Pin note"}
                              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                note.pinned ? "text-accent-token" : "text-muted hover:bg-tile hover:text-accent-token"
                              }`}
                            >
                              {note.pinned ? "Pinned" : "Pin"}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditNote(note)}
                              aria-label="Edit note"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-tile hover:text-navy"
                            >
                              <IconPencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeNote(note.id)}
                              aria-label="Delete note"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-tile hover:text-warn"
                            >
                              <IconX size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </CornerFrame>
            </div>
          ) : tool === "schedule" ? (
            /* SCHEDULE - weekly view */
            <div className="space-y-4">
              <CornerFrame className="p-5">
                <h2 className="section-label">Add to schedule</h2>
                <form onSubmit={handleAddSchedule} className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_140px_140px_1fr_auto] xl:items-end">
                  <label className="block space-y-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Day</span>
                    <select
                      value={scheduleDraft.day}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, day: e.target.value }))}
                      className={inputClass}
                    >
                      {DAYS.map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Start</span>
                    <input
                      type="time"
                      value={scheduleDraft.startTime}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, startTime: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">End</span>
                    <input
                      type="time"
                      value={scheduleDraft.endTime}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, endTime: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Subject</span>
                    <input
                      value={scheduleDraft.subject}
                      onChange={(e) => setScheduleDraft((d) => ({ ...d, subject: e.target.value }))}
                      placeholder="e.g. Mathematics"
                      className={inputClass}
                    />
                  </label>
                  <Button type="submit" variant="accent" icon={<IconPlus size={13} />} className="xl:mb-0.5">
                    Add
                  </Button>
                </form>
                {scheduleFormError && <p className="mt-2 text-xs text-warn">{scheduleFormError}</p>}
              </CornerFrame>

              <CornerFrame className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="section-label">Weekly view</h2>
                  <Chip>{scheduleItems.length} class{scheduleItems.length === 1 ? "" : "es"}</Chip>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {DAYS.map((day) => (
                    <div key={day} className="rounded-[10px] border border-base bg-tile p-3">
                      <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-token">{day}</p>
                      <div className="mt-2.5 space-y-2">
                        {scheduleByDay[day].length === 0 && (
                          <p className="text-[11px] text-faint">Free</p>
                        )}
                        {scheduleByDay[day].map((item) => (
                          <div key={item.id} className="group rounded-[8px] border border-line bg-surface px-2.5 py-2">
                            <div className="flex items-start justify-between gap-1.5">
                              <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-navy">{item.subject}</p>
                              <button
                                type="button"
                                onClick={() => removeScheduleItem(item.id)}
                                aria-label={`Remove ${item.subject}`}
                                className="shrink-0 text-faint transition hover:text-warn"
                              >
                                <IconX size={11} />
                              </button>
                            </div>
                            <p className="text-[10.5px] text-muted">
                              {formatTimeLabel(item.startTime)} - {formatTimeLabel(item.endTime)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CornerFrame>
            </div>
          ) : tool === "lessons" ? (
            /* LESSON PLANS */
            <div className="space-y-4">
              <CornerFrame className="p-5">
                <h2 className="section-label">New lesson plan</h2>
                <form onSubmit={handleAddLessonPlan} className="mt-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-[1fr_180px_140px_140px]">
                    <input
                      value={lessonDraft.title}
                      onChange={(e) => setLessonDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="Lesson title"
                      className={inputClass}
                    />
                    <input
                      type="date"
                      value={lessonDraft.date}
                      onChange={(e) => setLessonDraft((d) => ({ ...d, date: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      type="time"
                      value={lessonDraft.startTime}
                      onChange={(e) => setLessonDraft((d) => ({ ...d, startTime: e.target.value }))}
                      aria-label="Start time (optional)"
                      className={inputClass}
                    />
                    <input
                      type="time"
                      value={lessonDraft.endTime}
                      onChange={(e) => setLessonDraft((d) => ({ ...d, endTime: e.target.value }))}
                      aria-label="End time (optional)"
                      className={inputClass}
                    />
                  </div>
                  <textarea
                    value={lessonDraft.description}
                    onChange={(e) => setLessonDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="What will you cover?"
                    rows={2}
                    className={inputClass}
                  />
                  <Button type="submit" variant="accent" icon={<IconPlus size={13} />} disabled={!lessonDraft.title.trim()}>
                    Add lesson plan
                  </Button>
                </form>
              </CornerFrame>

              <CornerFrame className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="section-label">Lesson plans</h2>
                  <FilterPills options={lessonFilterPills} active={lessonFilter} onChange={setLessonFilter} />
                </div>
                <div className="mt-4 space-y-3">
                  {lessonPlans.length === 0 ? (
                    <EmptyState icon={<IconCompose />} title="No lesson plans yet" desc="Plans you add will appear here, organized by date." />
                  ) : (
                    <>
                      {(lessonFilter === "all" || lessonFilter === "upcoming") && lessonGroups.upcoming.length > 0 && (
                        <div>
                          <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Upcoming</p>
                          <div className="mt-2 space-y-2">
                            {lessonGroups.upcoming.map((plan) => renderLessonRow(plan))}
                          </div>
                        </div>
                      )}
                      {(lessonFilter === "all" || lessonFilter === "past") && lessonGroups.past.length > 0 && (
                        <div>
                          <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Past</p>
                          <div className="mt-2 space-y-2">
                            {lessonGroups.past.map((plan) => renderLessonRow(plan))}
                          </div>
                        </div>
                      )}
                      {lessonFilter === "upcoming" && lessonGroups.upcoming.length === 0 && (
                        <EmptyState icon={<IconCompose />} title="No upcoming plans" desc="Plans on or after today will appear here." />
                      )}
                      {lessonFilter === "past" && lessonGroups.past.length === 0 && (
                        <EmptyState icon={<IconCompose />} title="No past plans" desc="Plans before today will appear here." />
                      )}
                    </>
                  )}
                </div>
              </CornerFrame>
            </div>
          ) : (
            /* TASKS */
            <div className="space-y-4">
              <CornerFrame className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="section-label">Assigned by admin</h2>
                  <FilterPills options={filterPills} active={taskFilter} onChange={setTaskFilter} />
                </div>
                <div className="mt-4 space-y-2">
                  {filteredTasks.length === 0 ? (
                    <EmptyState
                      icon={<IconTask />}
                      title={taskFilter === "all" ? "No tasks assigned" : "No tasks in this state"}
                      desc={taskFilter === "all" ? "Tasks your admin assigns will appear here." : "Tasks move here when you take action on them."}
                    />
                  ) : (
                    filteredTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onAccept={(id) => acceptTask(id)}
                        onDecline={(id, reason) => declineTask(id, reason)}
                        onMarkDone={markTaskDone}
                        onReopen={reopenTask}
                        onDelete={deleteTask}
                      />
                    ))
                  )}
                </div>
              </CornerFrame>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeacherWorkspacePage() {
  // useSearchParams must sit inside a Suspense boundary during static rendering.
  return (
    <Suspense fallback={null}>
      <TeacherWorkspaceInner />
    </Suspense>
  );
}
