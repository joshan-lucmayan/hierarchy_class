"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BannerEditor } from "@/components/admin/BannerEditor";

export default function AdminSettingsPage() {
  const [schoolName, setSchoolName] = useState("CSA - College of Saint Amateil");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [autoEnrollment, setAutoEnrollment] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accountRequests, setAccountRequests] = useState([
    { id: "req-1", name: "Miguel Santos", role: "Student", type: "Account deletion", date: "2026-07-20" },
    { id: "req-2", name: "Ms. Daniela Fernandez", role: "Teacher", type: "Account deactivation", date: "2026-07-18" },
  ]);

  function resolveRequest(id: string) {
    setAccountRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Admin settings</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">System configuration</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Configure school-level defaults and runtime options for your portal.
        </p>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">My school</h2>
        <p className="mt-1 text-xs text-muted">Overview of the school registered to your admin account.</p>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-gold bg-navy text-base font-bold text-gold">
            CSA
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy">{schoolName}</p>
            <p className="mt-1 text-xs text-muted">Academic year {academicYear}</p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-600">
            Active
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
            <p className="text-2xl font-bold text-navy">842</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">Students</p>
          </div>
          <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
            <p className="text-2xl font-bold text-navy">46</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">Teachers</p>
          </div>
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Appearance</h2>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-base p-4">
          <div>
            <p className="text-sm font-semibold text-navy">Dark mode</p>
            <p className="mt-1 text-xs text-muted">Switch between light and dark theme.</p>
          </div>
          <ThemeToggle />
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Site banner</h2>
        <div className="mt-4">
          <BannerEditor />
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-muted">
              School name
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-muted">
              Academic year
              <input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex items-center justify-between rounded-3xl border border-base bg-[var(--surface-strong)] px-4 py-4 text-sm font-semibold text-navy">
              <span>Enable admin notifications</span>
              <button
                type="button"
                onClick={() => setEnableNotifications((v) => !v)}
                className={`h-6 w-11 shrink-0 rounded-full transition ${enableNotifications ? "bg-gold" : "bg-surface"}`}
              >
                <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${enableNotifications ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-3xl border border-base bg-[var(--surface-strong)] px-4 py-4 text-sm font-semibold text-navy">
              <span>Auto enrollment review</span>
              <button
                type="button"
                onClick={() => setAutoEnrollment((v) => !v)}
                className={`h-6 w-11 shrink-0 rounded-full transition ${autoEnrollment ? "bg-gold" : "bg-surface"}`}
              >
                <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${autoEnrollment ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSaved(true)}
            className="inline-flex items-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
          >
            Save settings
          </button>
          {saved ? <p className="text-sm text-emerald-600">Settings saved locally.</p> : null}
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Account requests</h2>
        <p className="mt-1 text-xs text-muted">Deactivation and deletion requests from students and teachers need your confirmation.</p>
        <div className="mt-4 space-y-3">
          {accountRequests.length === 0 ? (
            <p className="rounded-2xl border border-base p-4 text-sm text-muted">No pending requests.</p>
          ) : (
            accountRequests.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">{request.name} <span className="font-normal text-muted">· {request.role}</span></p>
                  <p className="mt-1 text-xs text-muted">{request.type} requested on {request.date}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => resolveRequest(request.id)}
                    className="rounded-full border border-red-300 bg-surface px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/10"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveRequest(request.id)}
                    className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CornerFrame>

      <p className="text-center text-xs text-muted">Hierarchy Class · v0.2.0</p>
    </div>
  );
}
