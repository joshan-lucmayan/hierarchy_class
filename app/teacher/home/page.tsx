"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";

export default function TeacherHomePage() {
  const [attendanceMarked, setAttendanceMarked] = useState(false);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Welcome back, Ms. Fernandez</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Manage your science class, upload learning materials, and submit student scores for review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAttendanceMarked(true)}
            className="rounded-full border border-gold bg-navy px-5 py-3 text-sm font-semibold text-gold transition hover:bg-gold hover:text-navy"
          >
            {attendanceMarked ? "Attendance marked" : "Mark attendance"}
          </button>
        </div>
      </CornerFrame>

      <div className="grid gap-6 xl:grid-cols-3">
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Active classes</p>
          <p className="mt-4 text-3xl font-bold text-navy">1</p>
          <p className="mt-2 text-sm text-muted">Grade 10 · Zeus</p>
        </CornerFrame>
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Uploaded materials</p>
          <p className="mt-4 text-3xl font-bold text-navy">4</p>
          <p className="mt-2 text-sm text-muted">Review or upload new lessons for the week.</p>
        </CornerFrame>
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Pending submissions</p>
          <p className="mt-4 text-3xl font-bold text-navy">2</p>
          <p className="mt-2 text-sm text-muted">Submitted grades waiting for admin approval.</p>
        </CornerFrame>
      </div>
    </div>
  );
}
