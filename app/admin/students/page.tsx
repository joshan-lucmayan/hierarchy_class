"use client";

import { useMemo, useState } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";

const RANK_STYLES: Record<string, string> = {
  "S++": "bg-navy text-gold",
  S: "bg-gold text-navy",
  A: "bg-blue-100 text-blue-700",
  B: "bg-green-100 text-green-700",
  C: "bg-gray-100 text-gray-600",
  D: "bg-red-100 text-red-600",
};

export default function AdminStudentsPage() {
  const { students, courses, getStudentAverage, getStudentRank, getEntriesByStudent } = useClassroomHierarchy();
  const [query, setQuery] = useState("");

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? "Unknown course";

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || courseName(s.courseId).toLowerCase().includes(q));
  }, [students, query, courses]);

  const overallAvg = useMemo(() => {
    const avgs = students.map((s) => getStudentAverage(s.id)).filter((v): v is number => v !== null);
    if (avgs.length === 0) return null;
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
  }, [students, getStudentAverage]);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Student Progress</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Monitor students</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Live averages and ranks computed from every grade teachers have submitted.
            </p>
          </div>
          <div className="rounded-3xl border border-gold bg-[var(--surface-strong)] px-5 py-4 text-sm">
            <p className="font-semibold text-gold">School average</p>
            <p className="text-muted">{overallAvg !== null ? `${overallAvg} / 100` : "No grades yet"}</p>
          </div>
        </div>
      </CornerFrame>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by student or course..."
        className="w-full max-w-md rounded-3xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm text-navy placeholder:text-muted outline-none"
      />

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <div className="divide-y divide-[var(--border)]">
          {filtered.length === 0 && <p className="py-4 text-sm text-muted">No students match your search.</p>}
          {filtered.map((student) => {
            const avg = getStudentAverage(student.id);
            const rank = getStudentRank(student.id);
            const entryCount = getEntriesByStudent(student.id).length;
            return (
              <div key={student.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-navy">{student.name}</p>
                  <p className="text-xs text-muted">{courseName(student.courseId)} · {entryCount} grade{entryCount === 1 ? "" : "s"} recorded</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-navy">{avg !== null ? avg : "--"}</p>
                  {rank && (
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${RANK_STYLES[rank]}`}>{rank}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CornerFrame>
    </div>
  );
}
