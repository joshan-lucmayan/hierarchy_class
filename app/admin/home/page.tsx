"use client";

import { useMemo, useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { useSchoolFeed, type SchoolPost } from "@/lib/schoolFeedStore";
import { useAccountRequests } from "@/lib/useAccountRequests";
import { PostEditor } from "@/components/admin/PostEditor";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { createClient } from "@/lib/supabase/client";

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

function FeedPostRow({ post, onEdit, onDelete }: { post: SchoolPost; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[10px] border border-base p-4 transition hover:border-gold/50">
      <div className="min-w-0">
        {post.title && <p className="text-sm font-semibold text-navy">{post.title}</p>}
        <p className={`${post.title ? "mt-0.5" : ""} line-clamp-2 text-xs text-muted`}>{post.body}</p>
        <p className="mt-1.5 text-[11px] text-muted">
          <span className="font-semibold text-gold">{post.tag}</span> · visible to {post.audience} ·{" "}
          {new Date(post.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-navy transition hover:border-gold"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this? This cannot be undone.")) onDelete();
          }}
          className="rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-red-300 hover:text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
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

export default function AdminHomePage() {
  const now = useMemo(() => new Date(), []);
  const { profile } = useMyProfile();
  const { courses, sections, programs, gradeEntries, students, refetch } = useClassroomHierarchy();
  const { tasks } = useTeacherTasks();
  const { posts, deletePost } = useSchoolFeed();
  const { requests: accountRequests, resolve: resolveAccountRequest } = useAccountRequests();
  const [editingPost, setEditingPost] = useState<null | { kind: "post" | "announcement"; id: string | null }>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const sectionName = (sectionId: string) => sections.find((s) => s.id === sectionId)?.name ?? "-";
  const programName = (programId: string) => programs.find((p) => p.id === programId)?.name ?? "-";

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
            // grade_entries.student_id is a profile id (FK to profiles).
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">
            {getGreeting(now.getHours())}{profile ? `, ${profile.full_name}` : ""}
          </h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Today · {todayDayName(now)}, {formatDisplayDate(now)}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditingPost({ kind: "post", id: null })}
            className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-on-accent transition hover:opacity-90"
          >
            + New post
          </button>
          <button
            type="button"
            onClick={() => setEditingPost({ kind: "announcement", id: null })}
            className="rounded-full border-2 border-gold bg-surface px-5 py-3 text-sm font-semibold text-navy transition hover:bg-gold/10"
          >
            + New announcement
          </button>
        </div>
      </div>

      {approvalError && (
        <p className="rounded-[10px] border border-red-300 bg-red-500/5 px-4 py-3 text-sm text-red-600">{approvalError}</p>
      )}

      {/* School posts + announcements - two clearly separate systems */}
      <div className="grid gap-6 xl:grid-cols-2">
        <CornerFrame className="overflow-hidden rounded-[10px] border border-base bg-surface">
          <div className="flex items-center gap-3 border-b border-gold/30 bg-gold/10 px-6 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-on-accent">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V5h4v14M16 19V5h4v14M12 5v14" />
              </svg>
            </span>
            <div>
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">School posts</h2>
              <p className="mt-0.5 text-xs text-muted">Social feed items shown on student and teacher home screens.</p>
            </div>
          </div>
          <div className="p-6">
            {posts.filter((p) => p.type === "post").length === 0 ? (
              <p className="text-sm text-muted">No school posts yet. Create one with the button above.</p>
            ) : (
              <div className="space-y-3">
                {posts
                  .filter((p) => p.type === "post")
                  .slice(0, 5)
                  .map((post) => (
                    <FeedPostRow key={post.id} post={post} onEdit={() => setEditingPost({ kind: "post", id: post.id })} onDelete={() => deletePost(post.id)} />
                  ))}
              </div>
            )}
          </div>
        </CornerFrame>

        <CornerFrame className="overflow-hidden rounded-[10px] border border-base bg-surface">
          <div className="flex items-center gap-3 border-b border-gold/30 bg-gold/10 px-6 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-on-accent">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9l9-5v16l-9-5H3a2 2 0 01-2-2v-2a2 2 0 012-2h1z" />
                <path d="M18 8a5 5 0 010 8M21 5a9 9 0 010 14" />
              </svg>
            </span>
            <div>
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">Announcements</h2>
              <p className="mt-0.5 text-xs text-muted">Important text-only notices that can notify the chosen audience.</p>
            </div>
          </div>
          <div className="p-6">
            {posts.filter((p) => p.type === "announcement").length === 0 ? (
              <p className="text-sm text-muted">No announcements yet. Create one with the button above.</p>
            ) : (
              <div className="space-y-3">
                {posts
                  .filter((p) => p.type === "announcement")
                  .slice(0, 5)
                  .map((post) => (
                    <FeedPostRow key={post.id} post={post} onEdit={() => setEditingPost({ kind: "announcement", id: post.id })} onDelete={() => deletePost(post.id)} />
                  ))}
              </div>
            )}
          </div>
        </CornerFrame>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CornerFrame className="space-y-4 rounded-[10px] border border-base bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">Pending grade submissions</h2>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
              {pendingGrades.length} open
            </span>
          </div>
          {pendingGrades.length === 0 ? (
            <p className="text-sm text-muted">No grade submissions waiting for approval.</p>
          ) : (
            <div className="space-y-4">
              {pendingGrades.map((submission) => (
                <div key={submission.id} className="rounded-[10px] border border-base p-4">
                  {/* Who submitted, for which course, when */}
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      name={submission.teacherName}
                      src={submission.teacherAvatar}
                      size="md"
                      className="!border-2 !border-gold/40"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">
                        {submission.teacherName}
                        <span className="ml-1 text-xs font-medium uppercase tracking-wide text-gold">Teacher</span>
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
                        <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                          Pending
                        </span>
                        <span className="rounded-full bg-[var(--surface-strong)] px-2.5 py-0.5 text-[10px] font-semibold text-muted">
                          {submission.students.length} student{submission.students.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
                    {submission.students.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-[10px] bg-[var(--surface-strong)] px-3 py-1.5 text-sm">
                        <p className="truncate text-muted">{s.name}</p>
                        <p className="font-semibold text-navy">{s.score}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={approvingId === submission.id}
                      onClick={() => handleApproval(submission.id, submission.entries.map((e) => e.id), true)}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {approvingId === submission.id ? "Updating..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={approvingId === submission.id}
                      onClick={() => handleApproval(submission.id, submission.entries.map((e) => e.id), false)}
                      className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <p className="ml-1 self-center text-[11px] text-muted">
                      Approving publishes these grades to students and updates the leaderboard.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CornerFrame>

        <div className="space-y-6">
          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">Teacher tasks awaiting action</h2>
              <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
                {pendingTasks.length} pending
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted">No tasks waiting for a teacher response.</p>
              ) : (
                pendingTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-[10px] border border-base p-3">
                    <p className="text-sm font-semibold text-navy">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted">Assigned to {task.teacherName}{task.dueDate ? ` · due ${task.dueDate}` : ""}</p>
                  </div>
                ))
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">Account requests</h2>
              <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
                {pendingRequests.length} open
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted">No pending deactivation/deletion requests.</p>
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

      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <h2 className="font-mono-ui text-[11px] font-medium uppercase tracking-[0.2em] text-navy">Recent system activity</h2>
        <div className="mt-4 space-y-2">
          {gradeEntries.length === 0 && tasks.length === 0 ? (
            <p className="text-sm text-muted">No activity recorded yet.</p>
          ) : (
            <>
              {gradeEntries.slice(0, 5).map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-[10px] border border-base p-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gold" />
                  <p className="flex-1 text-sm text-navy">
                    {studentName(g.studentId)} scored {g.score} on {g.label ?? g.type} in {courseName(g.courseId)}{" "}
                    <span className="text-xs text-muted">({g.approvalStatus})</span>
                  </p>
                  <span className="shrink-0 text-xs text-muted">{g.date}</span>
                </div>
              ))}
              {tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-[10px] border border-base p-3">
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
