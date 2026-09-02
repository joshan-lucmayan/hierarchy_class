"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Bar } from "@/components/ui/Bar";
import { MiniBars } from "@/components/ui/MiniBars";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy, type GradeEntry } from "@/lib/classroomHierarchyStore";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { useSchoolFeed, type SchoolPost } from "@/lib/schoolFeedStore";
import { useAccountRequests } from "@/lib/useAccountRequests";
import { resolveDeletionRequest } from "@/lib/bridgeClient";
import { useRankStore } from "@/lib/rankStore";
import { useAdminEnrollments } from "@/lib/useEnrollment";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { PostEditor } from "@/components/admin/PostEditor";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { RankDistribution } from "@/components/dashboard/RankDistribution";
import { SemesterProgress, semesterProgress } from "@/components/dashboard/SemesterProgress";
import { PresetPicker } from "@/components/dashboard/PresetPicker";
import { WidgetTile, SPAN_CLASS } from "@/components/teacher/WidgetTile";
import {
  useAdminPrefs,
  ADMIN_WIDGETS,
  ADMIN_WIDGET_BY_ID,
  ADMIN_PRESETS,
  addWidgetPlacement,
  removeWidgetPlacement,
  reorderWidgetPlacement,
  setWidgetSize,
  setWidgetTall,
  type AdminWidgetPlacement,
} from "@/lib/adminPrefsStore";
import {
  IconBell,
  IconCalendar,
  IconUser,
  IconTask,
  IconCompose,
  IconMegaphone,
  IconPost,
  IconCheck,
  IconX,
  IconPencil,
  IconTrash,
  IconChevronRight,
  IconPlus,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { getCurrentWeek, toISODate } from "@/lib/weekUtils";

interface SeasonHistoryRow {
  student_id: string;
  season_id: string | null;
  school_year: string | null;
  semester_label: string | null;
  peak_rank: string | null;
  final_rank_before_reset: string | null;
  reset_to_rank: string | null;
  ex_achieved: boolean | null;
  season_end_date: string;
  full_name: string;
}

function formatDisplayDate(now: Date) {
  return now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function todayDayName(now: Date) {
  return now.toLocaleDateString("en-US", { weekday: "long" });
}

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Skeleton building blocks - the app's pulse loading language. Each variant
 * matches the geometry it stands in for (card header, stat tiles, bars). */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-tile ${className}`} />;
}

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[10px] border border-base bg-surface p-3.5 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-[8px] border border-line bg-tile" />
        ))}
      </div>
      <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-2 h-1.5 w-4/5 rounded-full" />
    </div>
  );
}

function FeedPostRow({ post, onEdit, onDelete }: { post: SchoolPost; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <div className="flex items-start justify-between gap-4 rounded-[10px] border border-base bg-tile p-3.5 transition hover-border-accent-soft">
        <div className="min-w-0">
          {post.title && <p className="break-words text-sm font-semibold text-navy">{post.title}</p>}
          <p className={`${post.title ? "mt-0.5" : ""} line-clamp-2 break-words text-xs text-muted`}>{post.body}</p>
          <p className="mt-1.5 break-words text-[11px] text-muted">
            <span className="font-semibold text-accent-token">{post.tag}</span> · visible to {post.audience} ·{" "}
            {new Date(post.createdAt).toLocaleDateString()}
            {post.authorRole === "admin" && (
              <span className="ml-1.5 rounded border border-line px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted">
                Administrator
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" icon={<IconPencil size={12} />} onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" size="sm" icon={<IconTrash size={12} />} onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      </div>
      {confirming && (
        <Modal
          onClose={() => setConfirming(false)}
          eyebrow="Delete post"
          description={post.title ? `Delete "${post.title}"?` : "Delete this post?"}
          maxWidth="max-w-sm"
        >
          <p className="text-sm leading-6 text-muted">
            This removes the post for everyone in your school. This cannot be undone.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="danger"
              icon={<IconTrash size={13} />}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete post
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-faint">
            <IconChevronRight size={12} />
            <span className="text-[10px] uppercase tracking-[0.15em]">Destructive action</span>
          </div>
        </Modal>
      )}
    </>
  );
}

const ATTENTION_ICONS = {
  grades: IconBell,
  enrollment: IconCalendar,
  account: IconUser,
  tasks: IconTask,
} as const;

const BOOK_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const CHECK_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </svg>
);

const SHIELD_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="M22 4L12 14.01l-3-3" />
  </svg>
);

/** Add-widget picker inside the builder - shows only widgets not yet placed. */
function AdminWidgetPicker({ placed, onAdd }: { placed: string[]; onAdd: (id: string) => void }) {
  const available = ADMIN_WIDGETS.filter((w) => !placed.includes(w.id));
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

export default function AdminHomePage() {
  const now = useMemo(() => new Date(), []);
  const { profile } = useMyProfile();
  const {
    courses,
    sections,
    programs,
    gradeEntries,
    students,
    activeSemester,
    getCourseLeaderboard,
    refetch,
    loading: hierarchyLoading,
  } = useClassroomHierarchy();
  const { tasks } = useTeacherTasks();
  const { posts, deletePost } = useSchoolFeed();
  const { requests: accountRequests, refetch: refetchAccountRequests } = useAccountRequests();
  const { ranks: schoolRanks, loading: rankLoading } = useRankStore();
  const { statuses: enrollmentStatuses } = useAdminEnrollments();
  const { profiles: schoolProfiles } = useSchoolProfiles();
  const { prefs, loading: prefsLoading, error: prefsError, savePrefs, resetPrefs } = useAdminPrefs();
  const [editingPost, setEditingPost] = useState<null | { kind: "post" | "announcement"; id: string | null }>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [seasonHistory, setSeasonHistory] = useState<SeasonHistoryRow[] | null>(null);

  // Account-request review: server action verifies the admin + school and
  // executes the deletion on approve (with a destructive confirm dialog).
  const [confirmingRequestId, setConfirmingRequestId] = useState<string | null>(null);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [requestActionError, setRequestActionError] = useState<string | null>(null);

  async function handleAccountApprove(id: string) {
    setRequestBusyId(id);
    setRequestActionError(null);
    const result = await resolveDeletionRequest(id, "approved");
    setRequestBusyId(null);
    setConfirmingRequestId(null);
    if (!result.ok) {
      setRequestActionError(result.error ?? "Couldn't approve the request.");
      return;
    }
    refetchAccountRequests();
  }

  async function handleAccountDeny(id: string) {
    setRequestBusyId(id);
    setRequestActionError(null);
    const result = await resolveDeletionRequest(id, "denied");
    setRequestBusyId(null);
    if (!result.ok) {
      setRequestActionError(result.error ?? "Couldn't deny the request.");
      return;
    }
    refetchAccountRequests();
  }

  const loading = !profile || hierarchyLoading || prefsLoading;

  // Season history (school-wide, admin RPC) - for the compact progression trend.
  useEffect(() => {
    if (!profile?.school_id) return;
    let cancelled = false;
    const supabase = createClient();
    (supabase as any)
      .rpc("get_school_season_history", { p_school_id: profile.school_id })
      .then(({ data }: any) => {
        if (!cancelled && Array.isArray(data)) setSeasonHistory(data as SeasonHistoryRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.school_id]);

  // Real pending grade submissions: entries waiting for approval, grouped by
  // course + submitter + grade batch (type/date), enriched with the real
  // teacher, course, section, and program relationships.
  const pendingGrades = useMemo(() => {
    const pending = gradeEntries.filter((g) => g.approvalStatus === "pending");
    const groups = new Map<string, typeof pending>();
    pending.forEach((g) => {
      const key = `${g.courseId}|${g.submittedBy}|${g.date}|${g.label ?? g.type}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(g);
    });
    return Array.from(groups.entries())
      .map(([key, entries]) => {
        const course = courses.find((c) => c.id === entries[0].courseId);
        const section = course ? sections.find((s) => s.id === course.sectionId) : undefined;
        const program = section ? programs.find((p) => p.id === section.programId) : undefined;
        return {
          id: key,
          courseName: course?.name ?? "Unknown course",
          courseCode: course?.code ?? null,
          sectionName: section?.name ?? null,
          programName: program?.name ?? null,
          teacherName: entries[0].submittedByName ?? "A teacher",
          teacherAvatar: entries[0].submittedByAvatar ?? null,
          date: entries[0].date,
          submittedAt: entries[0].createdAt,
          type: entries[0].label ?? entries[0].type,
          entries,
          students: entries.map((e) => {
            const student = students.find((s) => s.profileId === e.studentId);
            return { id: e.id, name: student?.name ?? "Unknown student", score: e.score };
          }),
        };
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [gradeEntries, courses, sections, programs, students]);

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === "pending"), [tasks]);
  const pendingRequests = useMemo(() => accountRequests.filter((r) => r.status === "pending"), [accountRequests]);

  const studentName = (id: string) => students.find((s) => s.profileId === id)?.name ?? "A student";
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "a course";

  // School snapshot: students enrolled in courses, teachers, courses,
  // sections, programs - all from the already-mounted stores.
  const snapshot = useMemo(() => {
    const studentIds = new Set<string>();
    students.forEach((s) => {
      if (s.profileId) studentIds.add(s.profileId);
    });
    return [
      { label: "Students", value: studentIds.size },
      { label: "Teachers", value: schoolProfiles.filter((p) => p.role === "teacher").length },
      { label: "Courses", value: courses.length },
      { label: "Sections", value: sections.length },
      { label: "Programs", value: programs.length },
    ];
  }, [students, schoolProfiles, courses, sections, programs]);

  // Academic health: approved grades only, per course (teacher-configured
  // category weights via the shared leaderboard helper), rolled up to
  // programs and the whole school. Pending/rejected never count.
  const courseHealth = useMemo(
    () =>
      courses.map((c) => {
        const lb = getCourseLeaderboard(c.id);
        const avgs = lb.map((x) => x.avg).filter((a) => a > 0);
        return {
          course: c,
          avg: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null,
          graded: avgs.length,
        };
      }),
    [courses, getCourseLeaderboard]
  );
  const overallAvg = useMemo(() => {
    const avgs = courseHealth.map((c) => c.avg).filter((a): a is number => a !== null);
    return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  }, [courseHealth]);
  const programHealth = useMemo(() => {
    const byProgram = new Map<string, { name: string; avgs: number[] }>();
    courseHealth.forEach(({ course, avg }) => {
      const section = sections.find((s) => s.id === course.sectionId);
      const pid = section?.programId;
      if (!pid || avg === null) return;
      const program = programs.find((p) => p.id === pid);
      const entry = byProgram.get(pid) ?? { name: program?.name ?? "Unknown program", avgs: [] };
      entry.avgs.push(avg);
      byProgram.set(pid, entry);
    });
    return Array.from(byProgram.values())
      .map((e) => ({ name: e.name, avg: e.avgs.reduce((a, b) => a + b, 0) / e.avgs.length }))
      .sort((a, b) => b.avg - a.avg);
  }, [courseHealth, sections, programs]);

  // Grade pipeline: pending/approved/rejected counts, approval rate, oldest
  // pending submission, weekly submission volume + a 7-day bar.
  const pipeline = useMemo(() => {
    const pending = gradeEntries.filter((g) => g.approvalStatus === "pending");
    const approved = gradeEntries.filter((g) => g.approvalStatus === "approved");
    const rejected = gradeEntries.filter((g) => g.approvalStatus === "rejected");
    const decided = approved.length + rejected.length;
    const oldest = pending.reduce<GradeEntry | null>(
      (min, g) => (min === null || g.createdAt < min.createdAt ? g : min),
      null
    );
    const week = getCurrentWeek();
    const thisWeek = gradeEntries.filter((g) => {
      const d = toISODate(new Date(g.createdAt));
      return d >= week.start && d <= week.end;
    }).length;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = toISODate(new Date(Date.now() - (6 - i) * 86_400_000));
      const count = gradeEntries.filter((g) => toISODate(new Date(g.createdAt)) === d).length;
      return { label: new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "narrow" }), count };
    });
    return {
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      approvalRate: decided ? Math.round((approved.length / decided) * 100) : null,
      oldest: oldest ? relativeTime(oldest.createdAt) : null,
      thisWeek,
      days,
      maxDay: Math.max(...days.map((d) => d.count), 1),
    };
  }, [gradeEntries]);

  // Enrollment health: effective status at read time (expired when past
  // expiry), plus an explicit "expiring within 7 days" window.
  const enrollmentHealth = useMemo(() => {
    let active = 0;
    let expired = 0;
    let revoked = 0;
    let expiringSoon = 0;
    const expiringNames: string[] = [];
    const nowMs = Date.now();
    const SOON_MS = 7 * 86_400_000; // "expiring soon" = within 7 days
    Object.values(enrollmentStatuses).forEach((e) => {
      if (e.status === "revoked") {
        revoked += 1;
        return;
      }
      const exp = e.expiresAt ? new Date(e.expiresAt).getTime() : null;
      if (exp !== null && exp < nowMs) {
        expired += 1;
        return;
      }
      active += 1;
      if (exp !== null && exp - nowMs <= SOON_MS) {
        expiringSoon += 1;
        const person = schoolProfiles.find((x) => x.id === e.studentId);
        if (person?.full_name) expiringNames.push(person.full_name);
      }
    });
    return { active, expired, revoked, expiringSoon, expiringNames };
  }, [enrollmentStatuses, schoolProfiles]);

  // Teacher workload: open/pending tasks per teacher + overdue count.
  const workload = useMemo(() => {
    const todayIso = toISODate(new Date());
    const overdue = tasks.filter(
      (t) => t.status !== "done" && t.status !== "declined" && !!t.dueDate && t.dueDate < todayIso
    );
    const byTeacher = new Map<string, { name: string; pending: number; open: number }>();
    tasks.forEach((t) => {
      const entry = byTeacher.get(t.teacherId) ?? { name: t.teacherName, pending: 0, open: 0 };
      if (t.status === "pending") entry.pending += 1;
      if (t.status !== "done" && t.status !== "declined") entry.open += 1;
      byTeacher.set(t.teacherId, entry);
    });
    return {
      pending: tasks.filter((t) => t.status === "pending").length,
      overdue,
      byTeacher: Array.from(byTeacher.values()).sort((a, b) => b.open - a.open),
    };
  }, [tasks]);

  // Attention center: one place for everything actionable, no duplication of
  // the full pending-grades card (it links to it via anchor). Each issue
  // carries a title, a detail line, a count, and a destination.
  const attention = useMemo(() => {
    const items: {
      key: string;
      kind: "grades" | "enrollment" | "account" | "tasks";
      title: string;
      detail?: string;
      count: number;
      href: string;
    }[] = [];
    if (pipeline.pending > 0) {
      items.push({
        key: "grades",
        kind: "grades",
        title: "Grade submissions awaiting approval",
        detail: pipeline.oldest ? `Oldest: ${pipeline.oldest}` : undefined,
        count: pipeline.pending,
        href: "#pending-grades",
      });
    }
    if (enrollmentHealth.expiringSoon > 0) {
      items.push({
        key: "enroll",
        kind: "enrollment",
        title: "Enrollments expiring within 7 days",
        detail: enrollmentHealth.expiringNames.slice(0, 2).join(", ") || undefined,
        count: enrollmentHealth.expiringSoon,
        href: "/admin/students",
      });
    }
    if (pendingRequests.length > 0) {
      items.push({
        key: "acct",
        kind: "account",
        title: "Account requests to review",
        count: pendingRequests.length,
        href: "/admin/users",
      });
    }
    if (workload.overdue.length > 0) {
      items.push({
        key: "tasks",
        kind: "tasks",
        title: "Teacher tasks past due",
        count: workload.overdue.length,
        href: "/admin/teachers",
      });
    }
    return items;
  }, [pipeline, enrollmentHealth, pendingRequests, workload]);

  // Season-over-season progression (compact, last 3 seasons).
  const seasonSummary = useMemo(() => {
    if (!seasonHistory || seasonHistory.length === 0) return [];
    const bySeason = new Map<string, { label: string; end: string; rows: SeasonHistoryRow[] }>();
    seasonHistory.forEach((r) => {
      const key = r.season_id ?? `${r.school_year ?? ""}|${r.semester_label ?? ""}`;
      const entry = bySeason.get(key) ?? {
        label: [r.school_year, r.semester_label].filter(Boolean).join(" · ") || key,
        end: r.season_end_date,
        rows: [],
      };
      entry.rows.push(r);
      bySeason.set(key, entry);
    });
    return Array.from(bySeason.values())
      .sort((a, b) => b.end.localeCompare(a.end))
      .slice(0, 3)
      .map((s) => {
        const atLeastS = s.rows.filter((r) => ["S", "S+", "S++", "EX"].includes(r.final_rank_before_reset ?? "")).length;
        const ex = s.rows.filter((r) => r.ex_achieved).length;
        return { label: s.label, students: s.rows.length, atLeastS, ex };
      });
  }, [seasonHistory]);

  const nameOf = useCallback(
    (id: string) => schoolProfiles.find((p) => p.id === id)?.full_name ?? "Student",
    [schoolProfiles]
  );

  async function handleApproval(groupId: string, entryIds: string[], approved: boolean) {
    setApprovingId(groupId);
    setApprovalError(null);
    const supabase = createClient();
    const { error } = await (supabase as any).rpc("approve_grade_submission", {
      p_entry_ids: entryIds,
      p_approved: approved,
    });
    setApprovingId(null);
    if (error) {
      setApprovalError("Couldn't update the submission. Please try again.");
      return;
    }
    refetch();
  }

  /* ---------------------------------------------------------------- */
  /* Dashboard builder state - the validated Teacher Home model.       */
  /* ---------------------------------------------------------------- */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AdminWidgetPlacement[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** Enter edit mode with the current layout as the working draft. */
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

  /** Persist the draft (optimistic - the store owns the write). An empty
   * draft is a valid personal layout; saving it clears Home. */
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

  /** PRESET: loads a developer arrangement into the DRAFT - nothing persists
   * until Save. The user can still modify it freely. */
  function applyPreset(presetId: string) {
    const preset = ADMIN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft(preset.widgets.map((w, i) => ({ id: w.id, size: w.size, tall: w.tall, order: i })));
    setPresetsOpen(false);
    setClearArmed(false);
  }

  /** ADD: the widget joins the dashboard in saved order - CSS Grid places it. */
  function addWidget(id: string) {
    setDraft((prev) => addWidgetPlacement(prev ?? [], id));
    setPickerOpen(false);
  }

  /** REMOVE: layout only - the tile leaves Home, its data is never touched. */
  function removeWidget(id: string) {
    setDraft((prev) => removeWidgetPlacement(prev ?? [], id));
  }

  /** RESIZE: changes only the size span - CSS Grid reflows. */
  function changeSize(id: string, size: AdminWidgetPlacement["size"]) {
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

  // Entry point from Admin Settings ("Home Dashboard" -> Customize Home):
  // /admin/home?customize=1 opens the builder and strips the param.
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

  /* ---------------------------------------------------------------- */
  /* Widget content - projections of the existing Admin Home bands.    */
  /* ---------------------------------------------------------------- */
  const renderWidget = (id: string): React.ReactNode => {
    switch (id) {
      case "semester-progress":
        return <SemesterProgress semester={activeSemester} />;

      case "school-snapshot":
        return (
          <div className="min-h-full">
            <h2 className="section-label">School Snapshot</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {snapshot.map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
            <p className="mt-4 text-[11.5px] leading-5 text-muted">
              {activeSemester
                ? `${activeSemester.semester_label ?? "Semester"} is ${Math.round(semesterProgress(activeSemester).pct * 100)}% complete. Grades grade against this season.`
                : "No active semester - teachers can't submit grades until one is declared."}
            </p>
          </div>
        );

      case "hierarchy-health":
        return (
          <div className="min-h-full">
            {rankLoading ? (
              <CardSkeleton className="min-h-full p-3.5 sm:p-5" />
            ) : (
              <>
                <RankDistribution ranks={schoolRanks} title="Hierarchy Health" nameOf={nameOf} />
                {seasonSummary.length > 0 && (
                  <div className="mt-4 rounded-[10px] border border-base bg-surface p-4">
                    <h3 className="section-label">Season Progression</h3>
                    <div className="mt-3 space-y-2">
                      {seasonSummary.map((s) => (
                        <div
                          key={s.label}
                          className="flex items-center justify-between gap-3 rounded-[8px] border border-line bg-tile px-3 py-2"
                        >
                          <p className="min-w-0 truncate text-[12px] font-bold text-navy">{s.label}</p>
                          <p className="shrink-0 text-[10.5px] text-muted">
                            {s.students} tracked ·{" "}
                            <span className="font-semibold text-accent-token">{s.atLeastS}</span> S+ ·{" "}
                            <span className="font-semibold text-accent-token">{s.ex}</span> EX
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case "academic-health":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Academic Health</h2>
              {overallAvg !== null && <Chip variant="accent">School avg {overallAvg.toFixed(1)}</Chip>}
            </div>
            {programHealth.length === 0 ? (
              <EmptyState
                icon={BOOK_SVG}
                title="No approved grades yet"
                desc="Program averages appear once submissions are approved - pending and rejected grades never count."
              />
            ) : (
              <div className="mt-4 space-y-3">
                {programHealth.map((p) => (
                  <div key={p.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-navy">{p.name}</p>
                      <p className="shrink-0 text-[13px] font-bold tabular-nums text-accent-token">{p.avg.toFixed(1)}</p>
                    </div>
                    <Bar value={p.avg} tone="sealion" className="mt-1 w-full" />
                  </div>
                ))}
                <p className="border-t border-base pt-2.5 text-[11px] leading-5 text-muted">
                  Approved grades only, weighted by each course&apos;s configured category weights. The lowest-performing
                  programs stand out at a glance.
                </p>
              </div>
            )}
          </div>
        );

      case "attention-center":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Attention Center</h2>
              {attention.length > 0 && <Chip variant="danger">{attention.length} open</Chip>}
            </div>
            {attention.length === 0 ? (
              <EmptyState icon={SHIELD_SVG} title="All clear" desc="No urgent school actions right now." />
            ) : (
              <div className="mt-3.5 space-y-2">
                {attention.map((item) => {
                  const Icon = ATTENTION_ICONS[item.kind];
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="group flex items-center gap-3 rounded-[8px] border border-warn-soft bg-warn-soft px-3.5 py-3 transition hover:border-warn"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-warn">
                        <Icon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-navy">{item.title}</span>
                        {item.detail && <span className="block truncate text-[11px] text-muted">{item.detail}</span>}
                      </span>
                      <Chip variant="danger">{item.count}</Chip>
                      <span className="shrink-0 text-faint transition group-hover:translate-x-0.5">
                        <IconChevronRight size={14} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );

      case "grade-pipeline":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Grade Pipeline</h2>
              <Chip variant={pipeline.pending > 0 ? "warn" : "neutral"}>{pipeline.pending} pending</Chip>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Submissions / week" value={pipeline.thisWeek} />
              <Stat label="Approval rate" value={pipeline.approvalRate === null ? "n/a" : `${pipeline.approvalRate}%`} />
              <Stat label="Oldest pending" value={pipeline.oldest ?? "n/a"} />
              <Stat label="Approved" value={pipeline.approved} />
            </div>
            <div className="mt-4">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-faint">Last 7 days</p>
              <MiniBars
                data={pipeline.days.map((d) => ({ label: d.label, value: d.count }))}
                ariaLabel="Grade submissions per day, last 7 days"
              />
            </div>
          </div>
        );

      case "enrollment-health":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Enrollment Health</h2>
              {enrollmentHealth.expiringSoon > 0 && <Chip variant="warn">{enrollmentHealth.expiringSoon} expiring soon</Chip>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Active" value={enrollmentHealth.active} />
              <Stat label="Expired" value={enrollmentHealth.expired} tone={enrollmentHealth.expired > 0 ? "warn" : "default"} />
              <Stat label="Revoked" value={enrollmentHealth.revoked} tone={enrollmentHealth.revoked > 0 ? "warn" : "default"} />
              <Stat label="Expiring soon" value={enrollmentHealth.expiringSoon} tone={enrollmentHealth.expiringSoon > 0 ? "warn" : "default"} />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-muted">
              &quot;Expiring soon&quot; means within 7 days of the expiry the admin set. Manage dates under Admin ·
              Students.
            </p>
          </div>
        );

      case "teacher-workload":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">Teacher Workload</h2>
              <Chip>{workload.pending} pending</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {workload.byTeacher.length === 0 ? (
                <p className="text-sm text-muted">No tasks assigned yet.</p>
              ) : (
                workload.byTeacher.slice(0, 5).map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between gap-3 rounded-[8px] border border-line bg-tile px-3 py-2"
                  >
                    <p className="min-w-0 truncate text-[12.5px] font-medium text-navy">{t.name}</p>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted">
                      <span className="font-semibold text-navy">{t.open}</span> open · {t.pending} pending
                    </span>
                  </div>
                ))
              )}
              {workload.overdue.length > 0 && (
                <p className="border-t border-base pt-2 text-[11.5px] text-warn">
                  {workload.overdue.length} task{workload.overdue.length === 1 ? "" : "s"} past due.
                </p>
              )}
            </div>
          </div>
        );

      case "pending-grade-submissions":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
                Pending grade submissions
              </h2>
              <Chip>{pendingGrades.length} open</Chip>
            </div>
            {pendingGrades.length === 0 ? (
              <EmptyState
                icon={CHECK_SVG}
                title="No pending grades"
                desc="All teacher submissions are currently reviewed."
              />
            ) : (
              <div className="mt-4 space-y-3">
                {pendingGrades.map((submission) => (
                  <div key={submission.id} className="rounded-[10px] border border-base p-3.5">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={submission.teacherName}
                        src={submission.teacherAvatar}
                        size="md"
                        className="!border-2 !border-accent-soft"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy">
                          {submission.teacherName}
                          <span className="ml-1 text-xs font-medium uppercase tracking-wide text-accent-token">Teacher</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          submitted grades for <span className="font-semibold text-navy">{submission.courseName}</span>
                          {submission.courseCode ? ` (${submission.courseCode})` : ""} · {submission.type}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          Section: {submission.sectionName} · Program: {submission.programName}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-muted">Submitted {relativeTime(submission.submittedAt)}</span>
                          <Chip variant="warn">Pending</Chip>
                          <Chip>
                            {submission.students.length} student{submission.students.length === 1 ? "" : "s"}
                          </Chip>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 max-h-36 space-y-1.5 overflow-y-auto">
                      {submission.students.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-[10px] bg-[var(--surface-strong)] px-3 py-1.5 text-sm"
                        >
                          <p className="truncate text-muted">{s.name}</p>
                          <p className="font-semibold text-navy">{s.score}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="accent"
                        size="sm"
                        icon={<IconCheck size={12} />}
                        disabled={approvingId === submission.id}
                        loading={approvingId === submission.id}
                        onClick={() => handleApproval(submission.id, submission.entries.map((e) => e.id), true)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<IconX size={12} />}
                        disabled={approvingId === submission.id}
                        onClick={() => handleApproval(submission.id, submission.entries.map((e) => e.id), false)}
                      >
                        Reject
                      </Button>
                      <p className="ml-1 self-center text-[11px] text-muted">
                        Approving publishes these grades to students and updates the leaderboard.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "teacher-tasks":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
                Teacher tasks awaiting action
              </h2>
              <Chip>{pendingTasks.length} pending</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {pendingTasks.length === 0 ? (
                <EmptyState
                  icon={<IconTask />}
                  title="No tasks awaiting action"
                  desc="All assigned tasks have been answered by teachers."
                />
              ) : (
                pendingTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-[10px] border border-base p-3">
                    <p className="text-sm font-semibold text-navy">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Assigned to {task.teacherName}
                      {task.dueDate ? ` · due ${task.dueDate}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "account-requests":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">Account requests</h2>
              <Chip>{pendingRequests.length} open</Chip>
            </div>
            <div className="mt-4 space-y-3">
              {pendingRequests.length === 0 ? (
                <EmptyState
                  icon={<IconUser />}
                  title="No account requests"
                  desc="No deletion requests are waiting on you."
                />
              ) : (
                pendingRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="rounded-[10px] border border-base p-3">
                    <p className="text-sm font-semibold text-navy">
                      {request.requester_name ?? "A user"} <span className="font-normal text-muted">· {request.requester_role}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {request.type === "deletion" ? "Account deletion" : "Account deactivation"} requested on{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<IconCheck size={12} />}
                        loading={requestBusyId === request.id}
                        disabled={requestBusyId !== null}
                        onClick={() => setConfirmingRequestId(request.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<IconX size={12} />}
                        disabled={requestBusyId !== null}
                        onClick={() => handleAccountDeny(request.id)}
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {requestActionError && (
              <p className="mt-3 rounded-[10px] border border-warn-soft bg-warn-soft px-3 py-2 text-xs text-warn">
                {requestActionError}
              </p>
            )}
            {confirmingRequestId && (
              <Modal eyebrow="Account deletion" description="Permanent and irreversible" onClose={() => setConfirmingRequestId(null)}>
                <h2 className="mt-3 text-xl font-bold text-navy">Permanently delete this account?</h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  This permanently removes the user&apos;s account and personal data. School-required academic records
                  are retained or anonymized. This cannot be undone.
                </p>
                <div className="mt-5 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmingRequestId(null)} disabled={requestBusyId !== null}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    loading={requestBusyId === confirmingRequestId}
                    disabled={requestBusyId !== null}
                    onClick={() => handleAccountApprove(confirmingRequestId)}
                  >
                    Delete account permanently
                  </Button>
                </div>
              </Modal>
            )}
          </div>
        );

      case "recent-activity":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
                Recent system activity
              </h2>
              <Chip>{gradeEntries.length + tasks.length} events</Chip>
            </div>
            <div className="mt-4 space-y-2">
              {gradeEntries.length === 0 && tasks.length === 0 ? (
                <EmptyState
                  icon={<IconBell />}
                  title="No activity yet"
                  desc="Grade and task events will appear here as they happen."
                />
              ) : (
                <>
                  {gradeEntries.slice(0, 6).map((g) => (
                    <div key={g.id} className="flex items-center gap-3 rounded-[10px] border border-base bg-tile p-3">
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
                      <p className="flex-1 truncate text-sm text-navy">
                        {studentName(g.studentId)} scored {g.score} on {g.label ?? g.type} in {courseName(g.courseId)}
                      </p>
                      <span className="shrink-0 text-xs text-muted">{g.date}</span>
                    </div>
                  ))}
                  {tasks.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-[10px] border border-base bg-tile p-3">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-sealion" />
                      <Chip variant={t.status === "declined" ? "danger" : t.status === "done" ? "success" : "neutral"}>
                        {t.status === "declined" ? "Declined" : t.status === "accepted" ? "Accepted" : t.status === "done" ? "Completed" : "Assigned"}
                      </Chip>
                      <p className="flex-1 truncate text-sm text-navy">
                        {t.status === "declined"
                          ? `${t.teacherName} declined`
                          : t.status === "accepted"
                            ? `${t.teacherName} accepted`
                            : t.status === "done"
                              ? `${t.teacherName} completed`
                              : `Assigned`}{" "}
                        &quot;{t.title}&quot;
                      </p>
                      <span className="shrink-0 text-xs text-muted">{t.assignedDate}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        );

      case "school-feed":
        return (
          <div className="min-h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-label">School Feed &amp; Announcements</h2>
              <Chip>{posts.length} total</Chip>
            </div>
            <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              {(
                [
                  {
                    kind: "post" as const,
                    icon: <IconPost />,
                    title: "School posts",
                    desc: "Social feed items shown on student and teacher home screens.",
                    emptyTitle: "No school posts yet",
                    emptyDesc: "Create one with the button above when there is something worth sharing.",
                  },
                  {
                    kind: "announcement" as const,
                    icon: <IconMegaphone />,
                    title: "Announcements",
                    desc: "Important text-only notices that can notify the chosen audience.",
                    emptyTitle: "No announcements",
                    emptyDesc: "Create an announcement when the school needs to know something.",
                  },
                ]
              ).map((band) => {
                const list = posts.filter((p) => p.type === band.kind);
                return (
                  <div key={band.kind} className="min-w-0 rounded-[10px] border border-base bg-tile">
                    <div className="flex items-center gap-3 border-b border-base px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-token">
                        {band.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-mono-ui text-[10.5px] font-medium uppercase tracking-[0.2em] text-navy">
                          {band.title}
                        </h3>
                        <p className="mt-0.5 text-[11px] leading-4 text-muted">{band.desc}</p>
                      </div>
                      <Chip>{list.length} total</Chip>
                    </div>
                    <div className="p-3.5">
                      {list.length === 0 ? (
                        <EmptyState icon={band.icon} title={band.emptyTitle} desc={band.emptyDesc} />
                      ) : (
                        <div className="space-y-2.5">
                          {list.slice(0, 5).map((post) => (
                            <FeedPostRow
                              key={post.id}
                              post={post}
                              onEdit={() => setEditingPost({ kind: band.kind, id: post.id })}
                              onDelete={() => deletePost(post.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  /** The current placement list (draft in edit mode, saved in view). */
  const gridPlacements: AdminWidgetPlacement[] = editing ? (draft ?? []) : prefs.widgets;

  /** One view-mode tile: a plain CSS Grid child carrying its own span. The
   * two self-framed widgets (SemesterProgress, RankDistribution) render
   * directly; everything else gets the standard card frame. */
  const renderViewCard = (w: AdminWidgetPlacement) => {
    const def = ADMIN_WIDGET_BY_ID[w.id];
    if (!def) return null;
    const selfFramed = w.id === "semester-progress" || w.id === "hierarchy-health";
    return (
      <div
        key={w.id}
        id={w.id === "pending-grade-submissions" ? "pending-grades" : undefined}
        className={`col-span-12 ${SPAN_CLASS[w.size]} ${w.tall ? "md:row-span-2" : ""}`}
      >
        {selfFramed ? (
          <div className="h-full overflow-hidden">{renderWidget(w.id)}</div>
        ) : (
          <CornerFrame
            tone={w.id === "attention-center" ? "warn" : "default"}
            className="h-full min-h-full overflow-hidden p-3.5 sm:p-5"
          >
            {/* The card is a fixed viewport; taller content scrolls inside it. */}
            <div className="h-full overflow-y-auto">{renderWidget(w.id)}</div>
          </CornerFrame>
        )}
      </div>
    );
  };

  return (
    /* Same outer geometry as every app page (Teacher Home included): the
       standard capped content column from AppShell, no full-bleed overrides. */
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">
            {getGreeting(now.getHours())}{profile ? `, ${profile.full_name}` : ""}
          </h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Today · {todayDayName(now)}, {formatDisplayDate(now)}
          </h2>
        </div>
        {!editing && (
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <span className="font-mono-ui text-[10px] font-medium uppercase tracking-[0.2em] text-faint">Commands</span>
            <div className="flex items-center gap-1 rounded-[10px] border border-base bg-surface p-1">
              <Button
                variant="accent"
                shape="square"
                size="sm"
                icon={<IconCompose size={13} />}
                onClick={() => setEditingPost({ kind: "post", id: null })}
              >
                New post
              </Button>
              <Button
                variant="ghost"
                shape="square"
                size="sm"
                icon={<IconMegaphone size={13} />}
                onClick={() => setEditingPost({ kind: "announcement", id: null })}
              >
                Announcement
              </Button>
            </div>
          </div>
        )}
      </div>

      {approvalError && (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
          {approvalError}
        </p>
      )}

      {prefsError && (
        <p className="rounded-[8px] border border-warn-soft bg-warn-soft px-3 py-2 text-xs text-warn">
          Couldn&apos;t sync your Home layout - {prefsError.toLowerCase()}
        </p>
      )}

      {editing && (
        /* EDIT TOOLBAR - sticky so Add / Reset / Save / Cancel stay reachable */
        <div className="sticky top-2 z-20">
          <CornerFrame className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="section-label">Editing Admin Home</span>
                <Chip variant="accent">
                  {gridPlacements.length} tile{gridPlacements.length === 1 ? "" : "s"}
                </Chip>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconPlus size={12} />}
                  onClick={() => setPickerOpen(true)}
                >
                  Add widget
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconCompose size={12} />}
                  onClick={() => setPresetsOpen(true)}
                >
                  Presets
                </Button>
                <Button variant="outline" size="sm" onClick={handleClear}>
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
                  variant="accent"
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
              Drag a widget by its top bar to reorder it. Hover a card for edge resize handles (right/left = size,
              down/up = tall). Save persists, Cancel discards, Clear Home empties your dashboard - the data is never
              touched.
            </p>
          </CornerFrame>
        </div>
      )}

      {loading ? (
        /* Full-page skeleton on first load - never flash zeros. */
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <CardSkeleton className="p-3.5 sm:p-5" />
            <CardSkeleton className="p-3.5 sm:p-5" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <CardSkeleton className="p-3.5 sm:p-5" />
            <CardSkeleton className="p-3.5 sm:p-5" />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <CardSkeleton className="p-3.5 sm:p-5" />
            <CardSkeleton className="p-3.5 sm:p-5" />
            <CardSkeleton className="p-3.5 sm:p-5" />
          </div>
        </div>
      ) : editing && gridPlacements.length === 0 ? (
        /* EMPTY DRAFT - every widget removed: build from scratch or a preset. */
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconCompose />}
            title="No widgets on Home"
            desc="Add a widget to rebuild your command center, or start from a developer preset."
          />
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="accent" icon={<IconPlus size={13} />} onClick={() => setPickerOpen(true)}>
              Add a widget
            </Button>
            <Button variant="outline" icon={<IconCompose size={13} />} onClick={() => setPresetsOpen(true)}>
              Browse presets
            </Button>
          </div>
        </CornerFrame>
      ) : editing ? (
        /* EDIT MODE - the same CSS Grid as view mode, with arrange chrome. */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={gridPlacements.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-12 gap-4 auto-rows-[auto] md:auto-rows-[15rem]">
              {gridPlacements.map((w) => {
                const def = ADMIN_WIDGET_BY_ID[w.id];
                if (!def) return null;
                return (
                  <WidgetTile
                    key={w.id}
                    id={w.id}
                    label={def.label}
                    size={w.size}
                    tall={w.tall}
                    allowedSizes={def.sizes}
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
        /* EMPTY HOME - a fresh admin builds their command center from
           Settings -> Home Dashboard (or right here via the edit flow). */
        <CornerFrame className="p-10">
          <EmptyState
            icon={<IconCompose />}
            title="Build your own command center"
            desc="Choose the school-wide information and workflows you want to see here. Customize your Home from Settings - build it yourself or start from a preset."
          />
          <div className="mt-5 flex justify-center">
            <Link href="/admin/settings">
              <Button variant="accent" icon={<IconCompose size={13} />}>
                Customize in Settings
              </Button>
            </Link>
          </div>
        </CornerFrame>
      ) : (
        /* THE ADMIN'S DASHBOARD - a static CSS Grid with the same fixed row
           model as Teacher Home (auto-rows-[15rem]): `tall` always spans 2
           rows + gap, cards contain their content (internal scroll). */
        <div className="grid grid-cols-12 gap-4 auto-rows-[auto] md:auto-rows-[15rem]">
          {prefs.widgets.map(renderViewCard)}
        </div>
      )}

      {pickerOpen && (
        <Modal
          eyebrow="Admin Home"
          description="Pick a widget to add. It joins your dashboard in order - drag its top bar to rearrange, hover its edges to resize."
          maxWidth="max-w-2xl"
          onClose={() => setPickerOpen(false)}
        >
          <AdminWidgetPicker placed={gridPlacements.map((w) => w.id)} onAdd={addWidget} />
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
            presets={ADMIN_PRESETS}
            currentCount={gridPlacements.length}
            labelOf={(id) => ADMIN_WIDGET_BY_ID[id]?.label}
            onApply={(preset) => applyPreset(preset.id)}
            onKeepCurrent={() => setPresetsOpen(false)}
          />
        </Modal>
      )}

      {editingPost && (
        <PostEditor
          kind={editingPost.kind}
          post={editingPost.id ? (posts.find((p) => p.id === editingPost.id) ?? null) : null}
          onClose={() => setEditingPost(null)}
        />
      )}
    </div>
  );
}
