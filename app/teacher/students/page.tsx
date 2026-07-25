"use client";

import { useState } from "react";
import { CLASS_STUDENTS, TEACHER_PROFILE } from "@/data/mockStudents";
import { StudentDirectoryEntry } from "@/types/student";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { RankBadge } from "@/components/ui/RankBadge";

export default function TeacherStudentsPage() {
  const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryEntry>(CLASS_STUDENTS[0]);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher profile</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">{TEACHER_PROFILE.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {TEACHER_PROFILE.subject} teacher for Grade {TEACHER_PROFILE.gradeLevel} · {TEACHER_PROFILE.section} · {TEACHER_PROFILE.quarter}.
            </p>
          </div>
          <div className="rounded-3xl border border-gold bg-[var(--surface-strong)] px-5 py-4 text-sm">
            <p className="font-semibold text-gold">Office</p>
            <p className="text-muted">{TEACHER_PROFILE.office}</p>
            <p className="mt-3 font-semibold text-gold">Experience</p>
            <p className="text-muted">{TEACHER_PROFILE.experienceYears} years</p>
          </div>
        </div>
      </CornerFrame>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Class roster</p>
          <h2 className="mt-3 text-2xl font-bold text-navy">Grade 10 · Zeus</h2>
          <div className="mt-6 space-y-3">
            {CLASS_STUDENTS.filter((student) => student.gradeLevel === 10 && student.section === "Zeus").map((student) => (
              <button
                type="button"
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  selectedStudent.id === student.id
                    ? "border-gold bg-[var(--surface-strong)]"
                    : "border-base bg-surface hover:border-gold"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{student.name}</p>
                    <p className="text-xs text-muted">{student.favoriteSubject}</p>
                  </div>
                  <RankBadge rank={student.overallRank} size="sm" />
                </div>
              </button>
            ))}
          </div>
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Selected student</p>
          <div className="mt-4 rounded-3xl border border-gold bg-[var(--surface-strong)] p-6">
            <div className="flex items-center gap-4">
              <img src="/avatars/default-avatar.webp" alt={selectedStudent.name} className="h-16 w-16 rounded-full object-cover" />
              <div>
                <p className="text-lg font-semibold text-navy">{selectedStudent.name}</p>
                <p className="text-sm text-muted">Grade {selectedStudent.gradeLevel} · {selectedStudent.section}</p>
                <RankBadge rank={selectedStudent.overallRank} size="sm" className="mt-2" />
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-muted">
              <p><span className="font-semibold text-navy">Favorite subject:</span> {selectedStudent.favoriteSubject}</p>
              <p><span className="font-semibold text-navy">Tags:</span> {selectedStudent.tags.join(", ")}</p>
            </div>
          </div>
        </CornerFrame>
      </section>
    </div>
  );
}
