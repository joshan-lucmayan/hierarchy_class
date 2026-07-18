"use client";

import { useMemo, useState } from "react";
import { STUDENT_DIRECTORY } from "@/data/mockStudents";

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
      <section className="rounded-3xl border border-base bg-surface p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Grade submission</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Submit scores for Grade 10 · Zeus</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Enter grades for your students and submit the batch for admin approval.
            </p>
          </div>
          <div className="space-y-2 text-right">
            <p className={`rounded-full px-3 py-1 text-xs font-semibold ${submitted ? "bg-gold/15 text-gold" : "bg-slate-100 text-muted"}`}>
              {submitted ? "Pending admin approval" : "Ready to submit"}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Submit grades
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-base bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted">Student</th>
                <th className="px-6 py-4 font-semibold text-muted">Science</th>
                <th className="px-6 py-4 font-semibold text-muted">Mathematics</th>
                <th className="px-6 py-4 font-semibold text-muted">English</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gradeRows.map((row) => (
                <tr key={row.id} className="border-b border-base">
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
                        className="w-full rounded-2xl border border-base bg-slate-50 px-3 py-2 text-sm text-navy outline-none focus:border-navy"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-base bg-slate-50 px-6 py-4 text-sm text-muted">
          Enter values between 60 and 100 to reflect the latest class performance.
        </div>
      </section>
    </div>
  );
}
