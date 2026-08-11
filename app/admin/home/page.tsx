"use client";

import { useMemo, useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { useSchoolFeed } from "@/lib/schoolFeedStore";
import { useAccountRequests } from "@/lib/useAccountRequests";
import { PostEditor } from "@/components/admin/PostEditor";

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

export default function AdminHomePage() {
  const now = useMemo(() => new Date(), []);
  const { profile } = useMyProfile();
  const { courses, gradeEntries, students, setGradeApproval } = useClassroomHierarchy();
  const { tasks } = useTeacherTasks();
  const { posts, deletePost } = useSchoolFeed();
  const { requests: accountRequests, resolve: resolveAccountRequest } = useAccountRequests();
  const [editingPost, setEditingPost] = useState<null | "new" | string>(null);

  // Real pending grade submissions: entries waiting for approval, grouped by
  // course + submitter + entry date.
  const pendingGrades = useMemo(() => {
    const pending = gradeEntries.filter((g) => g.approvalStatus === "pending");
    const groups = new Map<string, typeof pending>();
    pending.forEach((g) => {
      const course = courses.find((c) => c.id === g.courseId);
      const key = `${g.courseId}|${g.submittedBy}|${g.date}|${g.label ?? g.type}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(g);
    });
    return Array.from(groups.entries())
      .map(([key, entries]) => {
        const course = courses.find((c) => c.id === entries[0].courseId);
        return {
          id: key,
          courseName: course?.name ?? "Unknown course",
          teacher: entries[0].submittedByName ?? "A teacher",
          date: entries[0].date,
          type: entries[0].label ?? entries[0].type,
          entries,
          students: entries.map((e) => {
            const student = students.find((s) => s.id === e.studentId);
            return { id: e.id, name: student?.name ?? "Unknown student", score: e.score };
          }),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [gradeEntries, courses, students]);

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === "pending"), [tasks]);
  const pendingRequests = useMemo(() => accountRequests.filter((r) => r.status === "pending"), [accountRequests]);

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "A student";
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "a course";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">
            {getGreeting(now.getHours())}{profile ? `, ${profile.full_name}` : ""}
          </h1>
          <h2 className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-navy">
            Today · {todayDayName(now)}, {formatDisplayDate(now)}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setEditingPost("new")}
          className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:opacity-90"
        >
          + New announcement
        </button>
      </div>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">School announcements</h2>
        <div className="mt-4 space-y-3">
          {posts.length === 0 ? (
            <p className="text-sm text-muted">No announcements published yet.</p>
          ) : (
            posts.slice(0, 5).map((post) => (
              <div key={post.id} className="flex items-start justify-between gap-4 rounded-2xl border border-base p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{post.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{post.body}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {post.tag} · {post.audience} · {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPost(post.id)}
                    className="rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-navy transition hover:border-gold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePost(post.id)}
                    className="rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-red-300 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CornerFrame>

      <div className="grid gap-6 xl:grid-cols-2">
        <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Pending grade submissions</h2>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
              {pendingGrades.length} open
            </span>
          </div>
          {pendingGrades.length === 0 ? (
            <p className="text-sm text-muted">No grade submissions waiting for approval.</p>
          ) : (
            <div className="space-y-4">
              {pendingGrades.map((submission) => (
                <div key={submission.id} className="rounded-3xl border border-base p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-navy">{submission.courseName} · {submission.type}</p>
                      <p className="mt-1 text-xs text-muted">{submission.date} · {submission.teacher}</p>
                    </div>
                    <span className="w-fit rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold">
                      {submission.entries.length} student{submission.entries.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
                    {submission.students.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-xl bg-[var(--surface-strong)] px-3 py-1.5 text-sm">
                        <p className="text-muted">{s.name}</p>
                        <p className="font-semibold text-navy">{s.score}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => submission.entries.forEach((e) => setGradeApproval(e.id, "approved"))}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => submission.entries.forEach((e) => setGradeApproval(e.id, "rejected"))}
                      className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CornerFrame>

        <div className="space-y-6">
          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Teacher tasks awaiting action</h2>
              <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
                {pendingTasks.length} pending
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted">No tasks waiting for a teacher response.</p>
              ) : (
                pendingTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-2xl border border-base p-3">
                    <p className="text-sm font-semibold text-navy">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted">Assigned to {task.teacherName}{task.dueDate ? ` · due ${task.dueDate}` : ""}</p>
                  </div>
                ))
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Account requests</h2>
              <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
                {pendingRequests.length} open
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted">No pending deactivation/deletion requests.</p>
              ) : (
                pendingRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="rounded-2xl border border-base p-3">
                    <p className="text-sm font-semibold text-navy">
                      {request.requester_name ?? "A user"} <span className="font-normal text-muted">· {request.requester_role}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {request.type === "deletion" ? "Account deletion" : "Account deactivation"} requested on{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => resolveAccountRequest(request.id, "approved")}
                        className="rounded-full border border-red-300 bg-surface px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/10"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveAccountRequest(request.id, "denied")}
                        className="rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-navy transition hover:border-gold"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CornerFrame>
        </div>
      </div>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Recent system activity</h2>
        <div className="mt-4 space-y-2">
          {gradeEntries.length === 0 && tasks.length === 0 ? (
            <p className="text-sm text-muted">No activity recorded yet.</p>
          ) : (
            <>
              {gradeEntries.slice(0, 5).map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-base p-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gold" />
                  <p className="flex-1 text-sm text-navy">
                    {studentName(g.studentId)} scored {g.score} on {g.label ?? g.type} in {courseName(g.courseId)}{" "}
                    <span className="text-xs text-muted">({g.approvalStatus})</span>
                  </p>
                  <span className="shrink-0 text-xs text-muted">{g.date}</span>
                </div>
              ))}
              {tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-base p-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <p className="flex-1 text-sm text-navy">
                    {t.status === "declined" ? `${t.teacherName} declined` : t.status === "accepted" ? `${t.teacherName} accepted` : t.status === "done" ? `${t.teacherName} completed` : `Assigned`} &quot;{t.title}&quot;
                  </p>
                  <span className="shrink-0 text-xs text-muted">{t.assignedDate}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </CornerFrame>

      {editingPost === "new" && <PostEditor post={null} onClose={() => setEditingPost(null)} />}
      {editingPost !== null && editingPost !== "new" && (
        <PostEditor
          post={posts.find((p) => p.id === editingPost) ?? null}
          onClose={() => setEditingPost(null)}
        />
      )}
    </div>
  );
}
