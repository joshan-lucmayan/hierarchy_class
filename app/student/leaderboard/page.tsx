"use client";

import { useMemo, useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { LEADERBOARD, CURRENT_STUDENT, CURRENT_QUARTER } from "@/data/mockStudents";
import { CornerFrame } from "@/components/ui/CornerFrame";

const GRADES = [10];
const SECTIONS = ["Zeus"];

export default function LeaderboardPage() {
  const [grade, setGrade] = useState(GRADES[0]);
  const [section, setSection] = useState(SECTIONS[0]);

  const filtered = useMemo(
    () => LEADERBOARD.filter((e) => e.student.gradeLevel === grade && e.student.section === section),
    [grade, section]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <section className="space-y-6">
        <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Leaderboard</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">Grade {grade} · {section}</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">{CURRENT_QUARTER}</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy outline-none"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy outline-none"
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </CornerFrame>

        <div className="space-y-3">
          {filtered.map((entry) => (
            <LeaderboardRow key={entry.student.id} entry={entry} isCurrentUser={entry.student.id === CURRENT_STUDENT.id} />
          ))}
        </div>
      </section>

      <CornerFrame className="h-fit rounded-3xl border border-base bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy">Rank quick view</p>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>Use this space to review the top performers in your section and compare your progress.</p>
          <div className="rounded-2xl border border-gold bg-[var(--surface-strong)] p-4">
            <p className="text-xs uppercase tracking-wide text-muted">You are</p>
            <p className="mt-2 text-2xl font-bold text-navy">Rank {filtered.findIndex((entry) => entry.student.id === CURRENT_STUDENT.id) + 1}</p>
          </div>
        </div>
      </CornerFrame>
    </div>
  );
}
