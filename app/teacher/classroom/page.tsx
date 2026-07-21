"use client";

import { useMemo, useState } from "react";
import { STUDENT_DIRECTORY } from "@/data/mockStudents";
import { CornerFrame } from "@/components/ui/CornerFrame";

type GradeRow = {
  id: string;
  name: string;
  science: string;
  mathematics: string;
  english: string;
};

export default function TeacherClassroomPage() {
  const classroomStudents = useMemo(
    () => STUDENT_DIRECTORY.filter((student) => student.gradeLevel === 10 && student.section === "Zeus"),
    []
  );
  const [gradeRows, setGradeRows] = useState<GradeRow[]>(
    classroomStudents.map((student) => ({
      id: student.id,
      name: student.name,
      science: "",
      mathematics: "",
      english: "",
    }))
  );
  const [submitted, setSubmitted] = useState(false);

  function updateGrade(id: string, subject: keyof Omit<GradeRow, "id" | "name">, value: string) {
    setGradeRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [subject]: value } : row))
    );
  }

  function handleSubmit() {
    setSubmitted(true);
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Grade submission</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Submit scores for Grade 10 · Zeus</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Enter grades for your students and submit the batch for admin approval.
            </p>
          </div>
          <div className="space-y-2 text-right">
            <p className={`rounded-full px-3 py-1 text-xs font-semibold ${submitted ? "bg-gold/20 text-gold" : "bg-[var(--surface-strong)] text-navy"}`}>
              {submitted ? "Pending admin approval" : "Ready to submit"}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:opacity-90"
            >
              Submit grades
            </button>
          </div>
        </div>
      </CornerFrame>

      <CornerFrame className="overflow-hidden rounded-3xl border border-base bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
            <thead className="bg-[var(--surface-strong)]">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted">Student</th>
                <th className="px-6 py-4 font-semibold text-muted">Science</th>
                <th className="px-6 py-4 font-semibold text-muted">Mathematics</th>
                <th className="px-6 py-4 font-semibold text-muted">English</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {gradeRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-4 text-sm font-medium text-navy">{row.name}</td>
                  {(["science", "mathematics", "english"] as const).map((subject) => (
                    <td key={subject} className="px-6 py-4">
                      <input
                        type="number"
                        min={60}
                        max={100}
                        value={row[subject]}
                        onChange={(e) => updateGrade(row.id, subject, e.target.value)}
                        placeholder="--"
                        className="w-full rounded-2xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-base bg-[var(--surface-strong)] px-6 py-4 text-sm text-muted">
          Enter values between 60 and 100 to reflect the latest class performance.
        </div>
      </CornerFrame>
    </div>
  );
}
