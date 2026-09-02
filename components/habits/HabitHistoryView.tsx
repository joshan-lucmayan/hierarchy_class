"use client";

import { useMemo, useState } from "react";
import type { Habit, HabitEntry, HabitPause } from "@/lib/habitStore";
import { dayComplete, isScheduled, addDays, toISO, weekdayIndex } from "@/lib/habitLogic";

/**
 * Contribution-style history grid: weeks as columns, days as rows, month labels
 * across the top. Always shows the full trackable window (from the earliest
 * entry, or 365 days back, up to today). The only control is the habit picker.
 */
export function HabitHistoryView({
  habits,
  entries,
  pauses,
}: {
  habits: Habit[];
  entries: HabitEntry[];
  pauses: HabitPause[];
}) {
  const today = toISO(new Date());
  const [habitId, setHabitId] = useState(habits[0]?.id ?? "");

  const habit = habits.find((h) => h.id === habitId) ?? habits[0] ?? null;

  const { dates, rows, monthLabels } = useMemo(() => {
    if (!habit) return { dates: [], rows: [], monthLabels: [] };

    // Full window: Jan 1 of the current year (so the full calendar shows
    // including empty/unfilled boxes), or earlier if the habit was started
    // before this year.
    const [y] = today.split("-").map(Number);
    let earliest: string | null = null;
    for (const e of entries) {
      if (e.habitId === habit.id && (earliest === null || e.entryDate < earliest)) earliest = e.entryDate;
    }
    const yearStart = `${y}-01-01`;
    const start = earliest !== null && earliest < yearStart ? earliest : yearStart;
    const allDates: string[] = [];
    let d = start;
    while (d <= today) {
      allDates.push(d);
      d = addDays(d, 1);
    }

    // Build week columns (Mon start).
    const first = allDates[0];
    const pad = weekdayIndex(first);
    const weekStart = addDays(first, -pad);
    const weekRows: string[][] = [];
    let w = weekStart;
    while (w <= allDates[allDates.length - 1]) {
      const week: string[] = [];
      for (let i = 0; i < 7; i++) week.push(addDays(w, i));
      weekRows.push(week);
      w = addDays(w, 7);
    }

    // Month labels spanning the weeks.
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthLbls: { label: string; span: number }[] = [];
    let currentMonth = "";
    let colStart = -1;
    for (let c = 0; c < weekRows.length; c++) {
      const mid = weekRows[c][3];
      if (mid > allDates[allDates.length - 1]) break;
      const m = monthNames[Number(mid.split("-")[1]) - 1];
      if (m !== currentMonth) {
        if (currentMonth !== "") monthLbls[monthLbls.length - 1].span = c - colStart;
        currentMonth = m;
        colStart = c;
        monthLbls.push({ label: m, span: 1 });
      }
    }
    if (monthLbls.length > 0) monthLbls[monthLbls.length - 1].span = weekRows.length - colStart;

    return { dates: allDates, rows: weekRows, monthLabels: monthLbls };
  }, [habit, entries, today]);

  const isPaused = (iso: string) =>
    pauses.some((p) => p.habitId === habit?.id && p.startedAt <= iso && (p.endedAt === null || iso <= p.endedAt));

  const weekCount = rows.length;

  function cell(iso: string) {
    const inRange = dates.includes(iso);
    const p = isPaused(iso);
    const scheduled = !p && isScheduled(habit!, iso);
    const future = iso > today;
    const complete = !future && inRange && dayComplete(habit!, iso, entries);

    if (!inRange) return "bg-transparent"; // padding days before/after the window
    if (future) return "bg-[var(--tile)] border border-[var(--line)]/40";
    if (complete) return "bg-gold/70 border border-gold/40";
    if (p || !scheduled) return "bg-[var(--tile)] border border-[var(--line)]/40";
    // scheduled but missed
    return "bg-[var(--warn)]/30 border border-[var(--warn)]/30";
  }

  function cellMark(iso: string) {
    if (!dates.includes(iso)) return "";
    const p = isPaused(iso);
    const scheduled = !p && isScheduled(habit!, iso);
    if (p || !scheduled) return "·";
    if (iso > today) return "";
    if (dayComplete(habit!, iso, entries)) return "✓";
    return "✕";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={habit?.id ?? ""}
          onChange={(e) => setHabitId(e.target.value)}
          aria-label="Habit for history"
          className="rounded-[8px] border border-line bg-tile px-2.5 py-1.5 text-[12.5px] font-semibold text-navy outline-none focus:border-sealion"
        >
          {habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        {habit && <span className="text-[11.5px] text-faint">{dates.length} days tracked</span>}
      </div>

      {!habit ? (
        <p className="mt-4 text-sm text-muted">No habits to show history for.</p>
      ) : (
        <div className="overflow-x-auto overscroll-contain pb-1 [scrollbar-width:thin]">
          <div className="min-w-max">
            {/* Month labels row */}
            <div className="flex items-center gap-1">
              <span className="w-7 shrink-0" />
              <div className="flex gap-1">
                {monthLabels.map((ml, i) => (
                  <span
                    key={`${ml.label}-${i}`}
                    className="text-center text-[9px] font-semibold uppercase tracking-wide text-faint"
                    style={{ width: `${ml.span * 20}px` }}
                  >
                    {ml.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="mt-1 flex items-start gap-1">
              {/* Weekday labels */}
              <div className="flex w-7 shrink-0 flex-col gap-1">
                {[0, 2, 4].map((row) => (
                  <span key={row} className="flex h-[18px] items-center text-[8.5px] font-semibold text-faint">
                    {row === 0 ? "Mon" : row === 2 ? "Wed" : "Fri"}
                  </span>
                ))}
              </div>

              {/* Week columns */}
              <div className="flex gap-1" style={{ width: `${weekCount * 20}px` }}>
                {rows.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map((iso) => {
                      const isToday = iso === today;
                      return (
                        <div
                          key={iso}
                          title={`${iso} ${cellMark(iso) ? `(${cellMark(iso)})` : ""}`}
                          className={`relative flex h-[18px] w-[18px] items-center justify-center rounded-[3px] text-[7px] font-bold transition-colors ${
                            isToday ? "ring-1 ring-navy ring-offset-[1px]" : ""
                          } ${cell(iso)}`}
                        >
                          {cellMark(iso) && (
                            <span className={iso <= today ? "text-on-accent" : "text-faint"}>
                              {cellMark(iso)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-base pt-2.5">
        <Legend color="bg-gold/70" mark="✓" label="Completed" />
        <Legend color="bg-[var(--warn)]/40" mark="✕" label="Missed" />
        <Legend color="bg-[var(--line)]/40" mark="·" label="Off-schedule" />
        <Legend color="bg-[var(--line)]/20" mark="" label="Future" />
        <Legend color="ring-1 ring-navy" mark="" label="Today" />
      </div>
    </div>
  );
}

function Legend({ color = "", mark = "", label }: { color?: string; mark?: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
      <span className={`flex h-4 w-4 items-center justify-center rounded-[3px] text-[8px] font-bold ${color}`}>
        {mark}
      </span>
      {label}
    </span>
  );
}