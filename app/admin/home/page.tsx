"use client";

import { useMemo, useState } from "react";
import { PENDING_GRADE_SUBMISSIONS } from "@/data/mockStudents";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useTeacherTasks } from "@/lib/teacherTasksStore";

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

type ActivityItem = {
  id: string;
  kind: "grade" | "task";
  text: string;
  date: string;
};

export default function AdminHomePage() {
  const now = useMemo(() => new Date(), []);
  const { profile } = useMyProfile();
  const { courses, gradeEntries, students } = useClassroomHierarchy();
  const { tasks } = useTeacherTasks();

  const [submissions, setSubmissions] = useState(PENDING_GRADE_SUBMISSIONS);

  function updateSubmissionStatus(id: string, status: "approved" | "rejected") {
    setSubmissions((prev) => prev.map((submission) => (submission.id === id ? { ...submission, status } : submission)));
  }

  const activity: ActivityItem[] = useMemo(() => {
    const gradeActivity: ActivityItem[] = gradeEntries.slice(0, 6).map((g) => {
      const course = courses.find((c) => c.id === g.courseId);
      const student = students.find((s) => s.id === g.studentId);
      return {
        id: `grade-${g.id}`,
        kind: "grade",
        text: `${student?.name ?? "A student"} scored ${g.score} on ${g.label ?? g.type} in ${course?.name ?? "a course"}`,
        date: g.date,
      };
    });

    const taskActivity: ActivityItem[] = tasks.slice(0, 6).map((t) => ({
      id: `task-${t.id}`,
      kind: "task",
      text:
        t.status === "declined"
          ? `${t.teacherName} declined "${t.title}"`
          : t.status === "accepted"
          ? `${t.teacherName} accepted "${t.title}"`
          : t.status === "done"
          ? `${t.teacherName} completed "${t.title}"`
          : `Assigned "${t.title}" to ${t.teacherName}`,
      date: t.assignedDate,
    }));

    return [...gradeActivity, ...taskActivity].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [gradeEntries, tasks, courses, students]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy">
          {getGreeting(now.getHours())}{profile ? `, ${profile.full_name}` : ""}
        </h1>
        <h2 className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-navy">
          Today · {todayDayName(now)}, {formatDisplayDate(now)}
        </h2>
      </div>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">System activity</h2>
        <div className="mt-4 space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-muted">No activity recorded yet.</p>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-base p-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${item.kind === "grade" ? "bg-gold" : "bg-blue-500"}`} />
                <p className="flex-1 text-sm text-navy">{item.text}</p>
                <span className="shrink-0 text-xs text-muted">{item.date}</span>
              </div>
            ))
          )}
        </div>
      </CornerFrame>

      <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Pending submissions</h2>
          <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
            {submissions.filter((item) => item.status === "pending").length} open
          </span>
        </div>
        <div className="space-y-4">
          {submissions.map((submission) => (
            <div key={submission.id} className="rounded-3xl border border-base p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">{submission.subject} scores</p>
                  <p className="mt-1 text-xs text-muted">{submission.level} • {submission.teacher}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  submission.status === "pending" ? "bg-gold/20 text-gold" :
                  submission.status === "approved" ? "bg-emerald-500/15 text-emerald-600" :
                  "bg-red-500/15 text-red-600"
                }`}>
                  {submission.status}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted">
                {submission.students.map((student) => (
                  <div key={student.studentId} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-strong)] px-3 py-2">
                    <p>{student.name}</p>
                    <p className="font-semibold text-navy">{student.grade}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateSubmissionStatus(submission.id, "approved")}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => updateSubmissionStatus(submission.id, "rejected")}
                  className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </CornerFrame>
    </div>
  );
}
