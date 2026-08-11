"use client";

import { useState } from "react";
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
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-navy">Dark mode</p>
            <p className="mt-1 text-xs text-muted">Switch between light and dark theme.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-4 border-t border-base pt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">About Hierarchy Class</h2>
        <p className="text-sm leading-6 text-muted">
          Hierarchy Class is a gamified learning tracker built for students, teachers, and admins. It uses ranks, materials, and library tools to keep progress visible and motivating.
        </p>
      </section>

      <section className="space-y-4 border-t border-base pt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Feedback</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Tell us what would make the app better"
            className="w-full border-b border-base bg-transparent px-1 py-2 text-sm text-navy outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
          >
            Send feedback
          </button>
          {submitted && <p className="text-sm text-green-600">Thanks! Your feedback has been submitted.</p>}
        </form>
      </section>

      <section className="space-y-4 border-t border-base pt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">Account</h2>
        <div className="divide-y divide-[var(--border)]">
          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
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
      </section>

      <p className="text-center text-xs text-muted">Hierarchy Class · v0.2.0</p>
    </div>
  );
}
