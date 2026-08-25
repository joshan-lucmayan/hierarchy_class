"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMyProfile } from "@/lib/useMyProfile";
import { useTeacherWorkspace, TeacherNote, ScheduleItem, LessonPlanItem } from "@/lib/teacherWorkspaceStore";
import {
  useTeacherPrefs,
  HOME_WIDGETS,
  WIDGET_BY_ID,
  TEACHER_PRESETS,
  addWidgetPlacement,
  removeWidgetPlacement,
  reorderWidgetPlacement,
  setWidgetSize,
  setWidgetTall,
  type TeacherWidgetPlacement,
} from "@/lib/teacherPrefsStore";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { useSchoolFeed } from "@/lib/schoolFeedStore";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useRankStore } from "@/lib/rankStore";
import {
  getGreeting,
  todayDayName,
  formatDisplayDate,
  todayDateInput,
  nowHHMM,
  formatTimeLabel,
  useNow,
  useIsMd,
} from "@/lib/teacherDayUtils";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Bar } from "@/components/ui/Bar";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { WidgetTile, SPAN_CLASS } from "@/components/teacher/WidgetTile";
import { TaskItem } from "@/components/teacher/TaskItem";
import {
  IconTask,
  IconTrendDown,
  IconChevronRight,
  IconPencil,
  IconPlus,
  IconMegaphone,
  IconCalendar,
  IconCompose,
  IconCheck,
} from "@/components/ui/icons";
import { FeedPost } from "@/components/feed/FeedPost";
import { RankDistribution } from "@/components/dashboard/RankDistribution";
import { PresetPicker } from "@/components/dashboard/PresetPicker";
import { getCurrentWeek, toISODate } from "@/lib/weekUtils";

const QUICK_ACTIONS = [
  { href: "/teacher/classroom", label: "Enter grades" },
  { href: "/teacher/learning-materials", label: "Materials" },
  { href: "/teacher/quiz", label: "Quiz" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/messages", label: "Messages" },
  { href: "/teacher/library-management", label: "Library" },
];

/** Skeleton block - the app's pulse loading language. */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-tile ${className}`} />;
}

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[10px] border border-base bg-surface ${className}`}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-3 h-2 w-full" />
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}

/** Add-widget picker inside the builder - shows only widgets not yet placed. */
function WidgetPicker({ placed, onAdd }: { placed: string[]; onAdd: (id: string) => void }) {
  const available = HOME_WIDGETS.filter((w) => !placed.includes(w.id));
  return (
    <div className="mt-4">
      {available.length === 0 ? (
        <p className="text-xs text-muted">Every widget is already on your Home.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((def) => (
            <div
              key={def.id}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-base bg-tile px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-navy">{def.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-4 text-muted">{def.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<IconPlus size={12} />}
                onClick={() => onAdd(def.id)}
                className="shrink-0"
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherHomePage() {
  const { profile, loading: profileLoading } = useMyProfile();
  const {
    notes,
    scheduleItems,
    lessonPlans,
    loading: workspaceLoading,
  } = useTeacherWorkspace();
  const { prefs, loading: prefsLoading, error: prefsError, savePrefs, resetPrefs } = useTeacherPrefs();

  const { getTasksByTeacher, acceptTask, declineTask, markTaskDone, reopenTask, deleteTask } = useTeacherTasks();
  const { posts: announcements, loading: feedLoading, error: feedError } = useSchoolFeed();
  const {
    courses,
    sections,
    students,
    gradeEntries,
    getCoursesByTeacher,
    getStudentsByCourse,
    getEntriesByProfile,
    getCourseLeaderboard,
    loading: hierarchyLoading,
  } = useClassroomHierarchy();
  const { ranks: allRanks, loading: rankLoading } = useRankStore();
  const assignedTasks = useMemo(
    () => (profile ? getTasksByTeacher(profile.id) : []),
    [profile, getTasksByTeacher]
  );

  const loading = !profile || hierarchyLoading || prefsLoading || workspaceLoading;

  // Teacher-scoped intelligence: only the teacher's own courses and students.
  const myCourses = useMemo(
    () => (profile ? getCoursesByTeacher(profile.id) : []),
    [profile, getCoursesByTeacher]
  );
  const myStudentIds = useMemo(() => {
    const set = new Set<string>();
    myCourses.forEach((c) =>
      getStudentsByCourse(c.id).forEach((s) => {
        if (s.profileId) set.add(s.profileId);
      })
    );
    return Array.from(set);
  }, [myCourses, getStudentsByCourse]);

  // Each assigned course: section, student count, average (approved grades,
  // teacher-configured weights) and the teacher's own pending submissions.
  const classHealth = useMemo(
    () =>
      myCourses.map((c) => {
        const lb = getCourseLeaderboard(c.id);
        const avgs = lb.map((x) => x.avg).filter((a) => a > 0);
        const avg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
        const section = sections.find((s) => s.id === c.sectionId);
        const pending = gradeEntries.filter(
          (e) => e.courseId === c.id && e.submittedBy === profile?.id && e.approvalStatus === "pending"
        ).length;
        return { course: c, sectionName: section?.name ?? "-", students: getStudentsByCourse(c.id).length, avg, pending };
      }),
    [myCourses, getCourseLeaderboard, sections, gradeEntries, profile, getStudentsByCourse]
  );

  // Rank distribution restricted to the teacher's own students only - never
  // the whole school.
  const myRanks = useMemo(
    () => allRanks.filter((r) => myStudentIds.includes(r.student_id)),
    [allRanks, myStudentIds]
  );

  // Data-driven attention signal: approved grades in my courses trending down
  // over the last gradings (same rule as the student Weakest Subject card).
  const decliningStudents = useMemo(() => {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const out: { id: string; name: string; course: string }[] = [];
    myStudentIds.forEach((id) => {
      const entries = getEntriesByProfile(id)
        .filter((e) => myCourses.some((c) => c.id === e.courseId) && e.approvalStatus === "approved")
        .sort((a, b) => a.date.localeCompare(b.date));
      if (entries.length >= 3) {
        const scores = entries.map((e) => e.score);
        if (avg(scores.slice(-2)) < avg(scores.slice(-4, -2))) {
          const name = students.find((s) => s.profileId === id)?.name ?? "Student";
          const lastCourse = courses.find((c) => c.id === entries[entries.length - 1].courseId);
          out.push({ id, name, course: lastCourse?.name ?? "a course" });
        }
      }
    });
    return out;
  }, [myStudentIds, getEntriesByProfile, myCourses, students, courses]);

  // My grading workflow: submitted entries by approval state + students with
  // no approved grades yet in any of my courses.
  const gradingStatus = useMemo(() => {
    const mine = gradeEntries.filter((e) => e.submittedBy === profile?.id);
    const week = getCurrentWeek();
    const thisWeek = mine.filter((e) => {
      const d = toISODate(new Date(e.createdAt));
      return d >= week.start && d <= week.end;
    }).length;
    const noGrades = myStudentIds.filter((id) => {
      const entries = getEntriesByProfile(id).filter((e) => myCourses.some((c) => c.id === e.courseId));
      return entries.filter((e) => e.approvalStatus === "approved").length === 0;
    }).length;
    return {
      pending: mine.filter((e) => e.approvalStatus === "pending").length,
      approved: mine.filter((e) => e.approvalStatus === "approved").length,
      rejected: mine.filter((e) => e.approvalStatus === "rejected").length,
      thisWeek,
      noGrades,
    };
  }, [gradeEntries, profile, myStudentIds, getEntriesByProfile, myCourses]);

  // Recent submission activity: the teacher's last entries with their current
  // approval state, newest first.
  const recentSubmissions = useMemo(
    () =>
      gradeEntries
        .filter((e) => e.submittedBy === profile?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [gradeEntries, profile]
  );
  const courseNameOf = (id: string) => courses.find((c) => c.id === id)?.name ?? "a course";

  // Task accept/decline/done generate real notifications to admins inside
  // teacherTasksStore, so no manual message hack is needed here.
  function handleAccept(taskId: string) {
    acceptTask(taskId);
  }

  const now = useNow();
  const isMd = useIsMd();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TeacherWidgetPlacement[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Touch devices need no extra sensor — PointerSensor covers touch + mouse.
  // Keeping KeyboardSensor for a11y; touch drag is via pointer events.

  /** Enter edit mode with the saved layout as the working draft. */
  function startEditing() {
    setDraft(prefs.widgets);
    setClearArmed(false);
    setEditing(true);
  }

  /** Discard unsaved changes and return to the saved dashboard. */
  function cancelEditing() {
    setEditing(false);
    setDraft(null);
    setClearArmed(false);
  }

  /** Persist the draft (optimistic - the store owns the write). */
  async function saveDraft() {
    setSaving(true);
    await savePrefs({ widgets: draft ?? [] });
    setSaving(false);
    setEditing(false);
    setDraft(null);
    setClearArmed(false);
  }

  /** Two-step clear: empties Home (presentation only - never touches data). */
  async function handleClear() {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    await resetPrefs();
    setEditing(false);
    setDraft(null);
  }

  // Entry point from Teacher Settings ("Home Dashboard" -> Customize Home):
  // /teacher/home?customize=1 opens the builder and strips the param.
  useEffect(() => {
    if (loading || editing) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("customize") === "1") {
      setDraft(prefs.widgets);
      setEditing(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("customize");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loading, editing, prefs]);

  /** ADD: the widget joins the dashboard in saved order - CSS Grid places it. */
  function addWidget(id: string) {
    setDraft((prev) => addWidgetPlacement(prev ?? [], id));
    setPickerOpen(false);
  }

  /** PRESET: loads a developer arrangement into the DRAFT - nothing persists
   * until Save. The user can still modify it freely. */
  function applyPreset(presetId: string) {
    const preset = TEACHER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft(preset.widgets.map((w, i) => ({ id: w.id, size: w.size, tall: w.tall, order: i })));
    setPresetsOpen(false);
    setClearArmed(false);
  }

  /** REMOVE: layout only - the tile leaves Home, its data is never touched. */
  function removeWidget(id: string) {
    setDraft((prev) => removeWidgetPlacement(prev ?? [], id));
  }

  /** RESIZE: changes only the size span - CSS Grid reflows. */
  function changeSize(id: string, size: TeacherWidgetPlacement["size"]) {
    setDraft((prev) => (prev ? setWidgetSize(prev, id, size) : prev));
  }

  /** TALL: changes only the row span - CSS Grid reflows. */
  function changeTall(id: string, tall: boolean) {
    setDraft((prev) => (prev ? setWidgetTall(prev, id, tall) : prev));
  }

  /** DRAG: order only. The transform is temporary and disappears on drop. */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((prev) => (prev ? reorderWidgetPlacement(prev, String(active.id), String(over.id)) : prev));
  }

  const today = todayDayName(now);
  const todayStr = todayDateInput(now);
  const currentHHMM = nowHHMM(now);

  const pinnedNotes: TeacherNote[] = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  // Projection data - the same rules as the Workspace tools, read-only here.
  const todaySchedule: ScheduleItem[] = useMemo(
    () =>
      scheduleItems
        .filter((s) => s.day === today && s.endTime >= currentHHMM)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [scheduleItems, today, currentHHMM]
  );

  const todayLessonPlans: LessonPlanItem[] = useMemo(
    () =>
      lessonPlans
        .filter((l) => l.date === todayStr && (!l.endTime || l.endTime >= currentHHMM))
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [lessonPlans, todayStr, currentHHMM]
  );

  const upcomingLessonPlans: LessonPlanItem[] = useMemo(
    () =>
      lessonPlans
        .filter((l) => l.date > todayStr)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || "")),
    [lessonPlans, todayStr]
  );

  // My teaching state: a compact snapshot of the day + load.
  const classesToday = useMemo(() => scheduleItems.filter((s) => s.day === today).length, [scheduleItems, today]);
  const nextClass = todaySchedule[0];

  const pendingTaskCount = useMemo(
    () => assignedTasks.filter((t) => t.status === "pending").length,
    [assignedTasks]
  );
  const overdueTasks = useMemo(
    () =>
      assignedTasks.filter(
        (t) => t.status !== "done" && t.status !== "declined" && !!t.dueDate && t.dueDate < toISODate(new Date())
      ),
    [assignedTasks]
  );

  /** Small outline link used as the footer of read-only projection widgets. */
  const workspaceLink = (href: string, label: string) => (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1 rounded-full border border-base bg-surface px-4 py-1.5 text-xs font-semibold text-navy transition hover-border-gold-soft hover-text-gold-token"
    >
      {label}
      <IconChevronRight size={12} />
    </Link>
  );

  /**
   * Content for one widget tile. The tile's frame is provided by the grid
   * card (view mode) or the edit chrome; content adapts to the tile's size.
   */
  const renderWidget = (id: string): React.ReactNode => {
    switch (id) {
      case "teaching-state":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">My Teaching State</h2>
              {nextClass && (
                <span className="truncate text-[11px] text-muted">
                  Up next: <span className="font-semibold text-gold-token">{formatTimeLabel(nextClass.startTime)} · {nextClass.subject}</span>
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Classes today" value={classesToday} />
              <Stat label="Courses" value={myCourses.length} />
              <Stat label="Students" value={myStudentIds.length} />
              <Stat label="Awaiting approval" value={gradingStatus.pending} tone={gradingStatus.pending > 0 ? "warn" : "default"} />
              <Stat label="Tasks to action" value={pendingTaskCount} tone={pendingTaskCount > 0 ? "warn" : "default"} />
              <Stat label="Submissions / week" value={gradingStatus.thisWeek} />
            </div>
          </div>
        );

      case "my-classes":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">My Classes</h2>
              <Chip variant="gold">
                {myCourses.length} course{myCourses.length === 1 ? "" : "s"}
              </Chip>
            </div>
            {myCourses.length === 0 ? (
              <div className="pt-4 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gold-soft text-gold-token">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </span>
                <p className="mt-3 font-mono-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-navy">
                  No courses assigned yet
                </p>
                <p className="mt-1 text-xs text-muted">Your admin assigns courses to teachers.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {classHealth.slice(0, 4).map((row) => (
                  <Link
                    key={row.course.id}
                    href="/teacher/classroom"
                    className="flex items-center gap-3 rounded-[10px] border border-base bg-tile p-3.5 transition hover-border-gold-soft"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-muted">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-navy">
                        {row.course.name}
                        {row.course.code ? ` (${row.course.code})` : ""}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        Section: {row.sectionName} · {row.students} student{row.students === 1 ? "" : "s"}
                      </p>
                    </div>
                    {row.avg !== null ? (
                      <div className="w-24 shrink-0">
                        <div className="flex items-baseline justify-between text-[10.5px]">
                          <span className="text-faint">Avg</span>
                          <span className="font-bold tabular-nums text-navy">{row.avg.toFixed(1)}</span>
                        </div>
                        <Bar value={row.avg} tone="sealion" className="mt-1 w-full" />
                      </div>
                    ) : (
                      <span className="shrink-0 text-[11px] text-faint">No grades yet</span>
                    )}
                    {row.pending > 0 && <Chip variant="warn">{row.pending} pending</Chip>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );

      case "grading-status":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Grading Status</h2>
              <Chip>{gradingStatus.thisWeek} this week</Chip>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Awaiting approval" value={gradingStatus.pending} tone={gradingStatus.pending > 0 ? "warn" : "default"} />
              <Stat label="Approved" value={gradingStatus.approved} />
              <Stat label="Rejected" value={gradingStatus.rejected} tone={gradingStatus.rejected > 0 ? "warn" : "default"} />
              <Stat label="No grades yet" value={gradingStatus.noGrades} tone={gradingStatus.noGrades > 0 ? "warn" : "default"} />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-muted">
              &quot;No grades yet&quot; counts your students without any approved grade in your courses - a real gap to
              fill, not a judgment.
            </p>
          </div>
        );

      case "recent-submissions":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Recent Submissions</h2>
              <Chip>{recentSubmissions.length} latest</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {recentSubmissions.slice(0, 4).length === 0 ? (
                <p className="text-sm text-muted">No submissions yet. Grades you enter will appear here.</p>
              ) : (
                recentSubmissions.slice(0, 4).map((g) => (
                  <div key={g.id} className="flex items-center gap-3 rounded-[8px] border border-line bg-tile px-3 py-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sealion" />
                    <Chip
                      variant={
                        g.approvalStatus === "approved"
                          ? "success"
                          : g.approvalStatus === "rejected"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {g.approvalStatus === "approved" ? "Approved" : g.approvalStatus === "rejected" ? "Rejected" : "Submitted"}
                    </Chip>
                    <p className="min-w-0 flex-1 truncate text-[12.5px] text-navy">
                      {g.label ?? g.type} · {courseNameOf(g.courseId)}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted">{g.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "students-attention":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Students Needing Attention</h2>
              {decliningStudents.length > 0 && <Chip variant="danger">{decliningStudents.length}</Chip>}
            </div>
            {decliningStudents.length === 0 ? (
              <EmptyState
                icon={<IconTrendDown />}
                title="All clear"
                desc="No students currently meet the attention criteria."
              />
            ) : (
              <div className="mt-3.5 space-y-2">
                {decliningStudents.slice(0, 4).map((s) => (
                  <Link
                    key={s.id}
                    href="/teacher/students"
                    className="group flex items-center gap-3 rounded-[8px] border border-warn-soft bg-warn-soft px-3.5 py-2.5 transition hover:border-warn"
                  >
                    <UserAvatar name={s.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-navy">{s.name}</span>
                      <span className="block truncate text-[11px] text-muted">Recent grades trending down in {s.course}</span>
                    </span>
                    <Chip variant="danger">Declining</Chip>
                    <span className="shrink-0 text-faint transition group-hover:translate-x-0.5">
                      <IconChevronRight size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );

      case "my-students":
        return rankLoading ? (
          <CardSkeleton className="min-h-full p-5" />
        ) : (
          <RankDistribution
            ranks={myRanks}
            title="My Students"
            nameOf={(sid) => students.find((s) => s.profileId === sid)?.name ?? "Student"}
          />
        );

      case "school-feed":
        return (
          <section className="min-h-full space-y-4">
            <h2 className="section-label">Latest School Feed</h2>
            {feedLoading ? (
              <div className="space-y-4">
                {[0, 1].map((i) => (
                  <div key={i} className="animate-pulse rounded-[10px] border border-base bg-surface p-5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-3 h-4 w-full" />
                    <Skeleton className="mt-2 h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : feedError ? (
              <p className="text-sm text-warn">{feedError}</p>
            ) : announcements.length === 0 ? (
              <EmptyState
                icon={<IconMegaphone />}
                title="No announcements yet"
                desc="School posts and announcements will appear here."
              />
            ) : (
              <div className="space-y-4">
                {announcements.slice(0, 2).map((post) => (
                  <FeedPost key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        );

      case "assigned-tasks":
        return (
          <div className="min-h-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-label">Assigned Tasks</h2>
              <div className="flex flex-wrap gap-2">
                {pendingTaskCount > 0 && <Chip variant="warn">{pendingTaskCount} pending</Chip>}
                {overdueTasks.length > 0 && <Chip variant="danger">{overdueTasks.length} overdue</Chip>}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {assignedTasks.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[8px] border border-line bg-tile px-3 py-2.5">
                  <IconTask size={13} className="shrink-0 text-faint" />
                  <p className="text-xs text-muted">No tasks assigned yet.</p>
                </div>
              ) : (
                assignedTasks.slice(0, 3).map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onAccept={handleAccept}
                    onDecline={(tid, reason) => declineTask(tid, reason)}
                    onMarkDone={markTaskDone}
                    onReopen={reopenTask}
                    onDelete={deleteTask}
                  />
                ))
              )}
            </div>
          </div>
        );

      case "today-schedule":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Today&apos;s Schedule</h2>
              <Chip variant="gold">{todaySchedule.length} remaining</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {todaySchedule.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[8px] border border-line bg-tile px-3 py-2.5">
                  <IconCalendar size={13} className="shrink-0 text-faint" />
                  <p className="text-xs text-muted">Nothing left on today&apos;s schedule.</p>
                </div>
              ) : (
                todaySchedule.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-[8px] border border-line bg-tile px-3 py-2">
                    <p className="truncate text-[12.5px] font-semibold text-navy">{item.subject}</p>
                    <p className="text-[11px] text-muted">{formatTimeLabel(item.startTime)} - {formatTimeLabel(item.endTime)}</p>
                  </div>
                ))
              )}
            </div>
            {workspaceLink("/teacher/workspace?tool=schedule", "Open schedule")}
          </div>
        );

      case "today-lessons":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Today&apos;s Lesson Plans</h2>
              <Chip variant="gold">{todayLessonPlans.length} today</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {todayLessonPlans.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[8px] border border-line bg-tile px-3 py-2.5">
                  <IconCompose size={13} className="shrink-0 text-faint" />
                  <p className="text-xs text-muted">Nothing in today&apos;s lesson plan.</p>
                </div>
              ) : (
                todayLessonPlans.slice(0, 4).map((plan) => (
                  <div key={plan.id} className="rounded-[8px] border border-line bg-tile px-3 py-2">
                    <p className="truncate text-[12.5px] font-semibold text-navy">{plan.title}</p>
                    {plan.startTime && plan.endTime && (
                      <p className="text-[11px] text-gold-token">{formatTimeLabel(plan.startTime)} - {formatTimeLabel(plan.endTime)}</p>
                    )}
                  </div>
                ))
              )}
            </div>
            {workspaceLink("/teacher/workspace?tool=lessons", "Open lesson plans")}
          </div>
        );

      case "pinned-notes":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Pinned Notes</h2>
              <Chip>{pinnedNotes.length} pinned</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {pinnedNotes.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[8px] border border-line bg-tile px-3 py-2.5">
                  <IconPencil size={13} className="shrink-0 text-faint" />
                  <p className="text-xs text-muted">No pinned notes yet.</p>
                </div>
              ) : (
                pinnedNotes.slice(0, 3).map((note) => (
                  <div key={note.id} className="rounded-[8px] border border-gold-soft bg-[var(--surface-strong)] px-3 py-2">
                    <p className="line-clamp-2 text-[12.5px] text-navy">{note.text}</p>
                  </div>
                ))
              )}
            </div>
            {workspaceLink("/teacher/workspace?tool=notes", "Open notes")}
          </div>
        );

      case "upcoming-lessons":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Upcoming Lesson Plans</h2>
              <Chip variant="gold">{upcomingLessonPlans.length} ahead</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {upcomingLessonPlans.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[8px] border border-line bg-tile px-3 py-2.5">
                  <IconCompose size={13} className="shrink-0 text-faint" />
                  <p className="text-xs text-muted">Nothing planned ahead yet.</p>
                </div>
              ) : (
                upcomingLessonPlans.slice(0, 4).map((plan) => (
                  <div key={plan.id} className="rounded-[8px] border border-line bg-tile px-3 py-2">
                    <p className="truncate text-[12.5px] font-semibold text-navy">{plan.title}</p>
                    <p className="text-[11px] text-muted">{plan.date}{plan.startTime && plan.endTime ? ` · ${formatTimeLabel(plan.startTime)} - ${formatTimeLabel(plan.endTime)}` : ""}</p>
                  </div>
                ))
              )}
            </div>
            {workspaceLink("/teacher/workspace?tool=lessons", "Open lesson plans")}
          </div>
        );

      default:
        return null;
    }
  };

  /** The current placement list (draft in edit mode, saved in view). */
  const gridPlacements: TeacherWidgetPlacement[] = editing ? (draft ?? []) : prefs.widgets;

  /** One view-mode tile: a plain CSS Grid child carrying its own span. */
  const renderViewCard = (w: TeacherWidgetPlacement) => {
    const def = WIDGET_BY_ID[w.id];
    if (!def) return null;
    return (
      <div key={w.id} className={`col-span-12 ${SPAN_CLASS[w.size]} ${w.tall ? "md:row-span-2" : ""}`}>
        {w.id === "my-students" ? (
          <div className="h-full overflow-hidden">{renderWidget(w.id)}</div>
        ) : (
          <CornerFrame
            tone={w.id === "students-attention" ? "warn" : "default"}
            className="h-full min-h-full overflow-hidden p-5"
          >
            {/* The card is a fixed viewport; taller content scrolls inside it. */}
            <div className="h-full overflow-y-auto">{renderWidget(w.id)}</div>
          </CornerFrame>
        )}
      </div>
    );
  };

  return (
    /* Same outer geometry as every app page (Admin Home included): the
       standard capped content column from AppShell, no full-bleed overrides. */
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* HEADER + QUICK ACTIONS                                      */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">
            {getGreeting(now.getHours())}{profileLoading ? "" : profile ? `, ${profile.full_name}` : ""}
          </h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Today · {todayDayName(now)}, {formatDisplayDate(now)}
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover-border-gold-soft hover-text-gold-token"
          >
            {action.label}
          </Link>
        ))}
      </div>

      {prefsError && (
        <p className="rounded-[8px] border border-warn-soft bg-warn-soft px-3 py-2 text-xs text-warn">
          Couldn&apos;t sync your Home layout - {prefsError.toLowerCase()}
        </p>
      )}

      {editing && (
        /* EDIT TOOLBAR - sticky so Save / Cancel stay reachable while scrolling */
        <div className="sticky top-2 z-20">
          <CornerFrame className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="section-label">Editing your Home</span>
                <Chip variant="gold">
                  {gridPlacements.length} tile{gridPlacements.length === 1 ? "" : "s"}
                </Chip>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconCompose size={12} />}
                  onClick={() => setPresetsOpen(true)}
                >
                  Presets
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconPlus size={12} />}
                  onClick={() => setPickerOpen(true)}
                >
                  Add widget
                </Button>
                <Button variant="danger" size="sm" onClick={() => void handleClear()}>
                  {clearArmed ? "Confirm clear" : "Clear Home"}
                </Button>
                {clearArmed && (
                  <button
                    type="button"
                    onClick={() => setClearArmed(false)}
                    className="text-xs font-semibold text-muted transition hover:text-navy"
                  >
                    Cancel
                  </button>
                )}
                <Button variant="ghost" size="sm" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  icon={<IconCheck size={13} />}
                  loading={saving}
                  onClick={() => void saveDraft()}
                >
                  Save layout
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted">
              {isMd
                ? "Drag a widget by its top bar to reorder it. Hover a card for edge resize handles (right/left = size, down/up = tall). On small screens widgets stack full width."
                : "Drag a widget by its top bar to reorder it. Hover a card for edge resize handles. Widgets stack full width on small screens."}
            </p>
          </CornerFrame>
        </div>
      )}

      {loading ? (
        /* Full-page skeleton on first load - never flash the empty state. */
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <CardSkeleton className="p-5" />
          <div className="grid gap-4 xl:grid-cols-2">
            <CardSkeleton className="p-5" />
            <CardSkeleton className="p-5" />
          </div>
        </div>
      ) : editing && gridPlacements.length === 0 ? (
        /* EMPTY EDIT STATE - the teacher builds their Home from scratch. */
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconCompose />}
            title="Your Home is empty"
            desc="Add a widget to start building your command center. Widgets flow row by row in the order you arrange them."
          />
          <div className="mt-5 flex justify-center">
            <Button variant="gold" icon={<IconPlus size={13} />} onClick={() => setPickerOpen(true)}>
              Add a widget
            </Button>
          </div>
        </CornerFrame>
      ) : editing ? (
        /* EDIT MODE - the same CSS Grid as view mode, with arrange chrome. */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={gridPlacements.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-12 gap-4 auto-rows-[auto] md:auto-rows-[15rem]">
              {gridPlacements.map((w) => {
                const def = WIDGET_BY_ID[w.id];
                if (!def) return null;
                return (
                  <WidgetTile
                    key={w.id}
                    id={w.id}
                    label={def.label}
                    size={w.size}
                    tall={w.tall}
                    onRemove={() => removeWidget(w.id)}
                    onSizeChange={(s) => changeSize(w.id, s)}
                    onTallChange={(t) => changeTall(w.id, t)}
                  >
                    {renderWidget(w.id)}
                  </WidgetTile>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : prefs.widgets.length === 0 ? (
        /* EMPTY DASHBOARD - the teacher owns their Home. Customization lives
           in Settings -> Home Dashboard -> Customize Home. */
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconCompose />}
            title="Build your own command center"
            desc="Choose the tools and information you want to see here. Customize your Home from Settings - build it yourself or start from a preset."
          />
          <div className="mt-5 flex justify-center">
            <Link href="/teacher/settings">
              <Button variant="gold" icon={<IconPlus size={13} />}>
                Customize in Settings
              </Button>
            </Link>
          </div>
        </CornerFrame>
      ) : (
        /* THE TEACHER'S DASHBOARD - a static CSS Grid, same as Admin Home.
           Rows are a FIXED unit (15rem): content-sized rows made `tall`
           invisible for widgets whose content already filled the row, because
           a row-span-2 tile's content is distributed across both rows. With a
           fixed row height, `tall` always spans 2 rows + gap and visibly
           grows, for every widget, in every layout. Cards contain their
           content (overflow-hidden + internal scroll in view mode). */
        <div className="grid grid-cols-12 gap-4 auto-rows-[auto] md:auto-rows-[15rem]">
          {prefs.widgets.map(renderViewCard)}
        </div>
      )}

      {pickerOpen && (
        <Modal
          eyebrow="Home"
          description="Pick a widget to add. It joins your dashboard in order - drag its top bar to rearrange, hover its edges to resize."
          maxWidth="max-w-2xl"
          onClose={() => setPickerOpen(false)}
        >
          <WidgetPicker placed={gridPlacements.map((w) => w.id)} onAdd={addWidget} />
        </Modal>
      )}

      {presetsOpen && (
        <Modal
          eyebrow="Home presets"
          description="Choose a preset to preview how your Home will look, then make it yours."
          maxWidth="max-w-3xl"
          onClose={() => setPresetsOpen(false)}
        >
          <PresetPicker
            presets={TEACHER_PRESETS}
            currentCount={gridPlacements.length}
            labelOf={(id) => WIDGET_BY_ID[id]?.label}
            onApply={(preset) => applyPreset(preset.id)}
            onKeepCurrent={() => setPresetsOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
