"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Settings</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Account and support</h1>
          </div>
          <p className="max-w-xl text-sm text-muted">
            Update your preferences and send feedback.
          </p>
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
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">About Hierarchy Class</h2>
        <p className="mt-4 text-sm leading-6 text-muted">
          Hierarchy Class is a gamified learning tracker built for students, teachers, and admins. It uses ranks, materials, and library tools to keep progress visible and motivating.
        </p>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Feedback</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Tell us what would make the app better"
            className="w-full rounded-3xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
          >
            Send feedback
          </button>
          {submitted && <p className="text-sm text-green-600">Thanks! Your feedback has been submitted.</p>}
        </form>
      </CornerFrame>

      <p className="text-center text-xs text-muted">Hierarchy Class · v0.1.2</p>
    </div>
  );
}
