"use client";

import { useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { CornerFrame } from "@/components/ui/CornerFrame";

export default function TeacherSettingsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [gradeReminders, setGradeReminders] = useState(true);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-navy p-6 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher settings</p>
        <h1 className="mt-2 text-3xl font-bold">Preferences and account</h1>
        <p className="mt-3 text-sm leading-6 opacity-80">
          Manage your account, notification settings, and classroom defaults.
        </p>
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

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <LogoutButton />
      </CornerFrame>
    </div>
  );
}
