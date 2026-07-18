"use client";

import { useState } from "react";
import { CLASS_STUDENTS, TEACHER_PROFILE } from "@/data/mockStudents";
import { StudentDirectoryEntry } from "@/types/student";

export default function TeacherStudentsPage() {
  const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryEntry>(CLASS_STUDENTS[0]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-base bg-surface p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Teacher profile</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">{TEACHER_PROFILE.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {TEACHER_PROFILE.subject} teacher for Grade {TEACHER_PROFILE.gradeLevel} · {TEACHER_PROFILE.section}.
            </p>
          </div>
          <div className="rounded-3xl border border-base bg-slate-50 px-5 py-4 text-sm text-muted">
            <p className="font-semibold text-navy">Office</p>
            <p>{TEACHER_PROFILE.office}</p>
            <p className="mt-3 font-semibold text-navy">Experience</p>
            <p>{TEACHER_PROFILE.experienceYears} years</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-base bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Class roster</p>
          <h2 className="mt-3 text-2xl font-bold text-navy">Grade 10 · Zeus</h2>
          <div className="mt-6 space-y-3">
            {CLASS_STUDENTS.filter((student) => student.gradeLevel === 10 && student.section === "Zeus").map((student) => (
              <button
                type="button"
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  selectedStudent.id === student.id
                    ? "border-navy bg-slate-50"
                    : "border-base bg-surface hover:border-navy"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{student.name}</p>
                    <p className="text-xs text-muted">Rank {student.overallRank} · {student.favoriteSubject}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-muted">View</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl border border-base bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Selected student</p>
          <div className="mt-4 rounded-3xl border border-base bg-slate-50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy text-xl font-bold text-white">
                {selectedStudent.initials}
              </div>
              <div>
                <p className="text-lg font-semibold text-navy">{selectedStudent.name}</p>
                <p className="text-sm text-muted">Grade {selectedStudent.gradeLevel} · {selectedStudent.section}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-muted">
              <p>
                <span className="font-semibold text-muted">Rank:</span> {selectedStudent.overallRank}
              </p>
              <p>
                <span className="font-semibold text-muted">Favorite subject:</span> {selectedStudent.favoriteSubject}
              </p>
              <p>
                <span className="font-semibold text-muted">Tags:</span> {selectedStudent.tags.join(", ")}
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
