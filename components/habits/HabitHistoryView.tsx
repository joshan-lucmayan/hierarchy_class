"use client";

import { useMemo, useState } from "react";
import type { Habit, HabitEntry, HabitPause } from "@/lib/habitStore";
import { dayComplete, isScheduled, addDays, toISO, weekdayIndex } from "@/lib/habitLogic";
import { getCurrentWeek } from "@/lib/weekUtils";
import { DAY_LETTERS } from "@/components/habits/habitFormat";

const RANGES = [
  { key: "week", label: "This week" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "all", label: "All" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function rangeDates(range: RangeKey, today: string, earliestEntry: string | null): string[] {
  if (range === "week") {
    return getCurrentWeek().days.map((d) => d.date);
  }
  if (range === "all") {
    const start = earliestEntry ?? addDays(today, -30);
    const out: string[] = [];
    let d = start;
    while (d <= today) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }
  const days = range === "30" ? 30 : 90;
  const start = addDays(today, -(days - 1));
  const out: string[] = [];
  let d = start;
  while (d <= today) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/**
 * Historical habit activity: a 7-column day grid (Monday-first) for the chosen
 * range, with clear states: completed, missed (a scheduled day that passed
 * without a record), not scheduled, future, and today (outlined). Paused days
 * are treated as not scheduled, so pauses never show as missed.
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
  const [range, setRange] = useState<RangeKey>("week");

  const habit = habits.find((h) => h.id === habitId) ?? habits[0] ?? null;

  const earliest = useMemo(() => {
    let min: string | null = null;
    for (const e of entries) {
      if (e.habitId === habit?.id && (min === null || e.entryDate < min)) min = e.entryDate;
    }
    return min;
  }, [entries, habit?.id]);

  const dates = useMemo(
    () => (habit ? rangeDates(range, today, earliest) : []),
    [range, today, earliest, habit]
  );

  const rows = useMemo(() => {
    if (dates.length === 0) return [];
    // Start each row on the Monday on/before the first date.
    const first = dates[0];
    const pad = weekdayIndex(first);
    const start = addDays(first, -pad);
    const out: string[][] = [];
    let d = start;
    while (d <= dates[dates.length - 1]) {
      const row: string[] = [];
      for (let i = 0; i < 7; i++) {
        row.push(d);
        d = addDays(d, 1);
      }
      out.push(row);
    }
    return out;
  }, [dates]);

  const pausedOn = (iso: string) =>
    pauses.some((p) => p.habitId === habit?.id && p.startedAt <= iso && (p.endedAt === null || iso <= p.endedAt));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="flex items-center gap-1 rounded-[8px] border border-line bg-tile p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`rounded-[6px] px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  range === r.key ? "bg-gold text-on-accent" : "text-muted hover:text-navy"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {habit && <p className="text-[11.5px] text-faint">{habit.name} · {dates.length} days</p>}
      </div>

      {!habit ? (
        <p className="mt-4 text-sm text-muted">No habits to show history for.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {DAY_LETTERS.map((l, i) => (
              <p key={`${l}-${i}`} className="text-center text-[9.5px] font-semibold uppercase tracking-wide text-faint">
                {l}
              </p>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {rows.flat().map((iso) => {
              const inRange = dates.includes(iso);
              const isToday = iso === today;
              const paused = pausedOn(iso);
              const scheduled = !paused && isScheduled(habit, iso);
              const future = iso > today;
              const complete = dayComplete(habit, iso, entries);

              let cls = "border-transparent bg-transparent";
              let mark = "";
              if (!inRange) {
                cls = "border-transparent bg-transparent";
              } else if (paused || !scheduled) {
                cls = "border-transparent";
                mark = "·";
              } else if (future) {
                cls = "border-transparent";
                mark = "○";
              } else if (complete) {
                cls = "border-transparent bg-gold/15 text-gold";
                mark = "✓";
              } else {
                cls = "border-transparent text-[var(--warn)]";
                mark = "✕";
              }

              return (
                <div
                  key={iso}
                  title={iso}
                  className={`flex h-8 items-center justify-center rounded-[6px] border text-[12.5px] font-bold ${
                    isToday ? "border-sealion" : cls
                  } ${isToday ? "text-navy" : ""} ${inRange && !future && !paused && !scheduled ? "text-faint/40" : ""}`}
                >
                  {mark || (isToday ? "•" : "")}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-base pt-3">
            <Legend color="bg-gold/15 text-gold" mark="✓" label="Completed" />
            <Legend color="text-[var(--warn)]" mark="✕" label="Missed" />
            <Legend mark="·" label="Not scheduled" />
            <Legend color="text-faint/40" mark="○" label="Future" />
            <Legend color="border border-sealion text-navy" mark="•" label="Today" />
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color = "", mark, label }: { color?: string; mark: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <span className={`flex h-5 w-5 items-center justify-center rounded-[5px] text-[11px] font-bold ${color}`}>
        {mark}
      </span>
      {label}
    </span>
  );
}
