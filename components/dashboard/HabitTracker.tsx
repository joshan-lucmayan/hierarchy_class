"use client";

import type { ReactNode } from "react";
import { useHabits, HABIT_TYPES, HABIT_LABELS, type HabitType } from "@/lib/habitStore";
import { toISODate } from "@/lib/weekUtils";
import { CornerFrame } from "@/components/ui/CornerFrame";

/** Target completions per habit per week - the only place this number lives. */
const WEEKLY_TARGET = 10;

const ICON_PATHS: Record<HabitType, ReactNode> = {
  // Study - an open book
  study: (
    <>
      <path d="M2 4h6a4 4 0 014 4v12a3 3 0 00-3-3H2z" />
      <path d="M22 4h-6a4 4 0 00-4 4v12a3 3 0 013-3h7z" />
    </>
  ),
  // Exercise - a dumbbell
  exercise: (
    <>
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </>
  ),
  // Reading - a closed book
  reading: (
    <>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z" />
    </>
  ),
  // Sleep - a crescent moon
  sleep: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
  // Focus - a target
  focus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
};

/**
 * Compact weekly habit tracker (right-column list). One row per habit:
 * 38px dark tile icon + label/count on one line ("7 / 10"), thin progress
 * track underneath. Clicking a row toggles TODAY's entry in the real
 * habit_entries table - the aggregate count and bar move with it.
 */
export default function HabitTracker() {
  const { entries, loading, error, toggleHabit } = useHabits();
  const today = toISODate(new Date());

  const doneFor = (type: HabitType) => entries.filter((e) => e.habitType === type).length;
  const todayDone = (type: HabitType) =>
    entries.some((e) => e.habitType === type && e.entryDate === today);

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
          Habit Tracker
        </h2>
        <span className="shrink-0 text-[11px] text-faint">{WEEKLY_TARGET}/week target</span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      ) : (
        <div className="mt-3.5 space-y-3.5">
          {HABIT_TYPES.map((type) => {
            const done = doneFor(type);
            const pct = Math.min((done / WEEKLY_TARGET) * 100, 100);
            const pressed = todayDone(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleHabit(type, today)}
                aria-pressed={pressed}
                aria-label={`${HABIT_LABELS[type]}: ${done} of ${WEEKLY_TARGET} this week${pressed ? ", done today" : ""}`}
                className="group flex w-full items-center gap-3 rounded-lg text-left transition-opacity hover:opacity-90"
              >
                <span
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-line bg-tile text-muted transition-colors ${
                    pressed ? "text-gold" : ""
                  }`}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {ICON_PATHS[type]}
                  </svg>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium text-navy">
                      {HABIT_LABELS[type]}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-faint">
                      {done} / {WEEKLY_TARGET}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-sealion transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </CornerFrame>
  );
}
