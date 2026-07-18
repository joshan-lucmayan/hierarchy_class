"use client";

import { useMemo, useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { LEADERBOARD, CURRENT_STUDENT } from "@/data/mockStudents";

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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Leaderboard</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">Grade {grade} · {section}</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none focus:border-navy"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-navy outline-none focus:border-navy"
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {filtered.map((entry) => (
            <LeaderboardRow key={entry.student.id} entry={entry} isCurrentUser={entry.student.id === CURRENT_STUDENT.id} />
          ))}
        </div>
      </section>

      <aside className="rounded-3xl border border-gray-100 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy">Rank quick view</p>
        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <p>
            Use this space to review the top performers in your section and compare your progress.
          </p>
          <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">You are</p>
            <p className="mt-2 text-2xl font-bold text-navy">Rank {filtered.findIndex((entry) => entry.student.id === CURRENT_STUDENT.id) + 1}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
