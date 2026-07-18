"use client";

import { useState } from "react";

export default function TeacherHomePage() {
  const [attendanceMarked, setAttendanceMarked] = useState(false);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-base bg-surface p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Teacher dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Welcome back, Ms. Fernandez</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Manage your science class, upload learning materials, and submit student scores for review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAttendanceMarked(true)}
            className="rounded-full border border-base bg-surface px-5 py-3 text-sm font-semibold text-navy transition hover:border-navy hover:text-navy"
          >
            {attendanceMarked ? "Attendance marked" : "Mark attendance"}
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-base bg-surface p-6">
          <p className="text-xs uppercase tracking-wider text-muted">Active classes</p>
          <p className="mt-4 text-3xl font-bold text-navy">1</p>
          <p className="mt-2 text-sm text-muted">Grade 10 · Zeus</p>
        </div>
        <div className="rounded-3xl border border-base bg-surface p-6">
          <p className="text-xs uppercase tracking-wider text-muted">Uploaded materials</p>
          <p className="mt-4 text-3xl font-bold text-navy">4</p>
          <p className="mt-2 text-sm text-muted">Review or upload new lessons for the week.</p>
        </div>
        <div className="rounded-3xl border border-base bg-surface p-6">
          <p className="text-xs uppercase tracking-wider text-muted">Pending submissions</p>
          <p className="mt-4 text-3xl font-bold text-navy">2</p>
          <p className="mt-2 text-sm text-muted">Submitted grades waiting for admin approval.</p>
        </div>
      </div>
    </div>
  );
}
