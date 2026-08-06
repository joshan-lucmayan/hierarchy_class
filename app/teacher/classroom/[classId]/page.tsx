"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClassroom } from "@/lib/classroomStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";

function isValidGradeValue(value: string): boolean {
  if (value.trim() === "") return false;
  if (value.trim().toUpperCase() === "N") return true;
  const num = Number(value);
  return !Number.isNaN(num) && num >= 0 && num <= 100;
}

export default function ClassGradingPage() {
  const params = useParams<{ classId: string }>();
  const router = useRouter();
  const { classes, getGrade, setGrade, isSubmitted, submitGrades } = useClassroom();
  const { profiles: students, loading: studentsLoading, error: studentsError } = useSchoolProfiles({ role: "student" });
  const [validationMessage, setValidationMessage] = useState("");

  const cls = classes.find((c) => c.id === params.classId);
  const submittedAt = cls ? isSubmitted(cls.id) : null;

  const rows = useMemo(() => {
    if (!cls) return [];
    return students.map((student) => ({
      student,
      grade: getGrade(cls.id, student.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, students]);

  if (!cls) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">This class couldn&apos;t be found.</p>
        <button
          type="button"
          onClick={() => router.push("/teacher/classroom")}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
        >
          Back to classroom
        </button>
      </div>
    );
  }

  function handleSubmit() {
    if (!cls) return;
    const allValid = rows.every(({ student }) => {
      const g = getGrade(cls.id, student.id);
      return isValidGradeValue(g.quiz) && isValidGradeValue(g.exam);
    });

    if (!allValid) {
      setValidationMessage('Every student needs a Quiz and Exam value - enter a score from 0-100, or "N" if there was none today.');
      return;
    }

    setValidationMessage("");
    submitGrades(cls.id);
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/teacher/classroom")}
              className="text-xs font-semibold text-muted hover:text-navy"
            >
              ← Back to classroom
            </button>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {cls.levelLabel || "No level set"}{cls.section ? ` · ${cls.section}` : ""}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-navy">{cls.subjectName}</h1>
          </div>
          <div className="space-y-2 text-right">
            <p className={`rounded-full px-3 py-1 text-xs font-semibold ${submittedAt ? "bg-gold/20 text-gold" : "bg-[var(--surface-strong)] text-navy"}`}>
              {submittedAt ? `Submitted ${new Date(submittedAt).toLocaleString()}` : "Not submitted yet"}
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
        {validationMessage && <p className="mt-4 text-sm text-red-500">{validationMessage}</p>}
      </CornerFrame>

      <CornerFrame className="overflow-hidden rounded-3xl border border-base bg-surface shadow-card">
        {studentsLoading && <p className="p-6 text-sm text-muted">Loading students...</p>}
        {studentsError && <p className="p-6 text-sm text-red-500">{studentsError}</p>}
        {!studentsLoading && !studentsError && rows.length === 0 && (
          <p className="p-6 text-sm text-muted">No students found at your school yet.</p>
        )}

        {!studentsLoading && !studentsError && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                <thead className="bg-[var(--surface-strong)]">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-muted">Student</th>
                    <th className="px-6 py-4 font-semibold text-muted">Quiz</th>
                    <th className="px-6 py-4 font-semibold text-muted">Exam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map(({ student, grade }) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 text-sm font-medium text-navy">{student.full_name}</td>
                      <td className="px-6 py-4">
                        <input
                          value={grade.quiz}
                          onChange={(e) => setGrade(cls.id, student.id, "quiz", e.target.value)}
                          placeholder="Score or N"
                          className="w-28 rounded-2xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          value={grade.exam}
                          onChange={(e) => setGrade(cls.id, student.id, "exam", e.target.value)}
                          placeholder="Score or N"
                          className="w-28 rounded-2xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-base bg-[var(--surface-strong)] px-6 py-4 text-sm text-muted">
              Enter a score from 0-100, or type &quot;N&quot; if there was no quiz or exam today.
            </div>
          </>
        )}
      </CornerFrame>
    </div>
  );
}
