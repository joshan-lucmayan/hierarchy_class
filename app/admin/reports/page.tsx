"use client";

import { CornerFrame } from "@/components/ui/CornerFrame";

const SUMMARY_STATS = [
  { label: "Average academic excellence", value: "86.4" },
  { label: "Attendance rate", value: "94%" },
  { label: "Open incident reports", value: "2" },
  { label: "Teacher feedback score", value: "4.6 / 5" },
];

const RECENT_REPORTS = [
  { id: "r1", title: "Q3 academic performance summary", school: "CSA", date: "2026-07-18", type: "Performance" },
  { id: "r2", title: "Cafeteria incident - Grade 9", school: "CSA", date: "2026-07-15", type: "Incident" },
  { id: "r3", title: "Teacher feedback: Ms. Fernandez", school: "CSA", date: "2026-07-12", type: "Feedback" },
  { id: "r4", title: "Enrollment audit - new campus", school: "GIS", date: "2026-07-09", type: "Audit" },
];

const TYPE_STYLES: Record<string, string> = {
  Performance: "bg-emerald-500/15 text-emerald-600",
  Incident: "bg-red-500/15 text-red-600",
  Feedback: "bg-gold/20 text-gold",
  Audit: "bg-[var(--surface-strong)] text-navy",
};

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Reports</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Review reports</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Track school-wide performance, incident reports, and teacher feedback.
        </p>
      </CornerFrame>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_STATS.map((stat) => (
          <CornerFrame
            key={stat.label}
            className="rounded-3xl border border-base bg-surface p-6 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{stat.label}</p>
            <p className="mt-4 text-3xl font-bold text-navy">{stat.value}</p>
          </CornerFrame>
        ))}
      </section>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Recent reports</h2>
        <div className="mt-4 space-y-3">
          {RECENT_REPORTS.map((report) => (
            <div key={report.id} className="flex flex-col gap-2 rounded-2xl border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">{report.title}</p>
                <p className="mt-1 text-xs text-muted">{report.school} · {report.date}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-[11px] font-semibold ${TYPE_STYLES[report.type]}`}>
                {report.type}
              </span>
            </div>
          ))}
        </div>
      </CornerFrame>
    </div>
  );
}
