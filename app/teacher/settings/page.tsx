"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function TeacherSettingsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [gradeReminders, setGradeReminders] = useState(true);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher settings</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Preferences and account</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Manage your account, notification settings, and classroom defaults.
        </p>
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
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Notifications</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-base p-4">
            <div>
              <p className="text-sm font-semibold text-navy">Email notifications</p>
              <p className="mt-1 text-xs text-muted">Get emailed when a grade submission is approved or rejected.</p>
            </div>
            <button
              type="button"
              onClick={() => setEmailNotifs((v) => !v)}
              className={`h-6 w-11 shrink-0 rounded-full transition ${emailNotifs ? "bg-gold" : "bg-[var(--surface-strong)]"}`}
            >
              <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${emailNotifs ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-base p-4">
            <div>
              <p className="text-sm font-semibold text-navy">Grade deadline reminders</p>
              <p className="mt-1 text-xs text-muted">Weekly reminder to submit outstanding grades.</p>
            </div>
            <button
              type="button"
              onClick={() => setGradeReminders((v) => !v)}
              className={`h-6 w-11 shrink-0 rounded-full transition ${gradeReminders ? "bg-gold" : "bg-[var(--surface-strong)]"}`}
            >
              <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${gradeReminders ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-red-300 bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">Account</h2>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">Deactivate account</p>
              <p className="mt-1 text-xs text-muted">Temporarily disable your access. An admin needs to confirm this before it takes effect.</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-red-400 hover:text-red-600"
            >
              Deactivate account
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">Request account deletion</p>
              <p className="mt-1 text-xs text-muted">Sends a request to your school admin. Your account and data are only removed once they confirm it.</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full border border-red-300 bg-surface px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/10"
            >
              Request deletion
            </button>
          </div>
        </div>
      </CornerFrame>

      <p className="text-center text-xs text-muted">Hierarchy Class · v0.2.0</p>
    </div>
  );
}
