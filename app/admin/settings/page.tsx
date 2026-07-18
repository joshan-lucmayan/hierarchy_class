"use client";

import { useState } from "react";

export default function AdminSettingsPage() {
  const [schoolName, setSchoolName] = useState("CSA – College of Saint Amateil");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [autoEnrollment, setAutoEnrollment] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-base bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Admin settings</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">System configuration</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Configure school-level defaults and runtime options for your portal.
        </p>
      </section>

      <section className="rounded-3xl border border-base bg-surface p-6">
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-muted">
              School name
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full rounded-2xl border border-base bg-slate-50 px-4 py-3 text-sm text-navy outline-none focus:border-navy"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-muted">
              Academic year
              <input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-2xl border border-base bg-slate-50 px-4 py-3 text-sm text-navy outline-none focus:border-navy"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex items-center justify-between rounded-3xl border border-base bg-slate-50 px-4 py-4 text-sm font-semibold text-muted">
              <span>Enable admin notifications</span>
              <input type="checkbox" checked={enableNotifications} onChange={(e) => setEnableNotifications(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-3xl border border-base bg-slate-50 px-4 py-4 text-sm font-semibold text-muted">
              <span>Auto enrollment review</span>
              <input type="checkbox" checked={autoEnrollment} onChange={(e) => setAutoEnrollment(e.target.checked)} />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setSaved(true)}
            className="inline-flex items-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            Save settings
          </button>
          {saved ? <p className="text-sm text-emerald-700">Settings saved locally.</p> : null}
        </div>
      </section>
    </div>
  );
}
