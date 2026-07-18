"use client";

import { useState } from "react";

export default function TeacherHomePage() {
  const [attendanceMarked, setAttendanceMarked] = useState(false);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-100 bg-white p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Teacher dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Welcome back, Ms. Fernandez</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Manage your science class, upload learning materials, and submit student scores for review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAttendanceMarked(true)}
            className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-navy transition hover:border-navy hover:text-navy"
          >
            {attendanceMarked ? "Attendance marked" : "Mark attendance"}
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-6">
          <p className="text-xs uppercase tracking-wider text-slate-500">Active classes</p>
          <p className="mt-4 text-3xl font-bold text-navy">1</p>
          <p className="mt-2 text-sm text-slate-600">Grade 10 · Zeus</p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6">
          <p className="text-xs uppercase tracking-wider text-slate-500">Uploaded materials</p>
          <p className="mt-4 text-3xl font-bold text-navy">4</p>
          <p className="mt-2 text-sm text-slate-600">Review or upload new lessons for the week.</p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6">
          <p className="text-xs uppercase tracking-wider text-slate-500">Pending submissions</p>
          <p className="mt-4 text-3xl font-bold text-navy">2</p>
          <p className="mt-2 text-sm text-slate-600">Submitted grades waiting for admin approval.</p>
        </div>
      </div>
    </div>
  );
}
