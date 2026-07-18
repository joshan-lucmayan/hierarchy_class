"use client";

import { useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function SettingsPage() {
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFeedback("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-base bg-surface p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Settings</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Account and support</h1>
          </div>
          <p className="max-w-xl text-sm text-muted">
            Update your preferences, send feedback, or securely sign out.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-base bg-surface p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-navy">About Hierarchy Class</h2>
        <p className="mt-4 text-sm leading-6 text-muted">
          Hierarchy Class is a gamified learning tracker built for Grade 1-10 students, teachers, and admins. It uses ranks, materials, and library tools to keep progress visible and motivating.
        </p>
      </section>

      <section className="rounded-3xl border border-base bg-surface p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-navy">Feedback</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Tell us what would make the app better"
            className="w-full rounded-3xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-navy"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            Send feedback
          </button>
          {submitted && <p className="text-sm text-green-600">Thanks! Your feedback has been submitted.</p>}
        </form>
      </section>

      <section className="rounded-3xl border border-base bg-surface p-6">
        <LogoutButton />
      </section>
    </div>
  );
}
