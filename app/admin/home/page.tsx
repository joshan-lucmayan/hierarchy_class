"use client";

import { useState } from "react";
import { PENDING_GRADE_SUBMISSIONS } from "@/data/mockStudents";
import { CornerFrame } from "@/components/ui/CornerFrame";

export default function AdminHomePage() {
  const [submissions, setSubmissions] = useState(PENDING_GRADE_SUBMISSIONS);
  const [rankMapping, setRankMapping] = useState([
    { rank: "S++", range: "95-100" },
    { rank: "S", range: "90-94" },
    { rank: "A", range: "80-89" },
    { rank: "B", range: "70-79" },
    { rank: "C", range: "60-69" },
    { rank: "D", range: "0-59" },
  ]);
  const [saved, setSaved] = useState(false);

  function updateSubmissionStatus(id: string, status: "approved" | "rejected") {
    setSubmissions((prev) => prev.map((submission) => (submission.id === id ? { ...submission, status } : submission)));
  }

  function updateRankRange(index: number, value: string) {
    setRankMapping((prev) => prev.map((mapping, idx) => (idx === index ? { ...mapping, range: value } : mapping)));
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Admin control system</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Approve pending grade submissions</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Review teacher submissions and adjust rank mapping for the current academic year.
            </p>
          </div>
          <div className="rounded-3xl border border-gold bg-[var(--surface-strong)] px-5 py-4 text-sm">
            <p className="font-semibold text-gold">Submission queue</p>
            <p className="text-muted">{submissions.length} pending items</p>
          </div>
        </div>
      </CornerFrame>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <CornerFrame className="space-y-4 rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Pending submissions</h2>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">
              {submissions.filter((item) => item.status === "pending").length} open
            </span>
          </div>
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div key={submission.id} className="rounded-3xl border border-base p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-navy">{submission.subject} scores</p>
                    <p className="mt-1 text-xs text-muted">{submission.level} • {submission.teacher}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    submission.status === "pending" ? "bg-gold/20 text-gold" :
                    submission.status === "approved" ? "bg-emerald-500/15 text-emerald-600" :
                    "bg-red-500/15 text-red-600"
                  }`}>
                    {submission.status}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted">
                  {submission.students.map((student) => (
                    <div key={student.studentId} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-strong)] px-3 py-2">
                      <p>{student.name}</p>
                      <p className="font-semibold text-navy">{student.grade}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateSubmissionStatus(submission.id, "approved")}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSubmissionStatus(submission.id, "rejected")}
                    className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Rank mapping</h2>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-muted">Settings</span>
          </div>
          <div className="mt-4 space-y-3">
            {rankMapping.map((mapping, index) => (
              <div key={mapping.rank} className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
                <div>
                  <p className="mt-1 text-sm font-semibold text-navy">{mapping.rank}</p>
                </div>
                <input
                  value={mapping.range}
                  onChange={(e) => updateRankRange(index, e.target.value)}
                  className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="mt-4 inline-flex items-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
          >
            Save rank mapping
          </button>
          {saved ? <p className="mt-3 text-sm text-emerald-600">Rank mapping saved locally.</p> : null}
        </CornerFrame>
      </section>
    </div>
  );
}
