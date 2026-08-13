"use client";

import type { ReactNode } from "react";
import { useHabits, HABIT_TYPES, HABIT_LABELS, type HabitType } from "@/lib/habitStore";
import { toISODate } from "@/lib/weekUtils";
import { CornerFrame } from "@/components/ui/CornerFrame";

/** Target completions per habit per week - the single source of truth. */
const WEEKLY_TARGET = 10;

const ICON_PATHS: Record<HabitType, ReactNode> = {
  study: (
    <>
      <path d="M2 4h6a4 4 0 014 4v12a3 3 0 00-3-3H2z" />
      <path d="M22 4h-6a4 4 0 00-4 4v12a3 3 0 013-3h7z" />
    </>
  ),
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
  reading: (
    <>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z" />
    </>
  ),
  sleep: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
  focus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
};

const HABIT_DESCRIPTIONS: Record<HabitType, string> = {
  study: "Sessions of focused schoolwork or review",
  exercise: "Physical activity, workouts, or movement",
  reading: "Reading for class or for yourself",
  sleep: "A full night of rest before a school day",
  focus: "Deep, distraction-free work blocks",
};

export default function StudentHabitsPage() {
  const { entries, loading, error, toggleHabit } = useHabits();
  const today = toISODate(new Date());

  const doneFor = (type: HabitType) => entries.filter((e) => e.habitType === type).length;
  const todayDone = (type: HabitType) =>
    entries.some((e) => e.habitType === type && e.entryDate === today);

  const totalDone = HABIT_TYPES.reduce((sum, t) => sum + doneFor(t), 0);
  const totalTarget = HABIT_TYPES.length * WEEKLY_TARGET;
  const overallPct = Math.min((totalDone / totalTarget) * 100, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[11px] font-semibold uppercase tracking-[0.11em] text-faint">
          Habit Tracker
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tap a habit to check off today. Everything saves straight to your account.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-[10px] border border-dashed border-line bg-[var(--surface-strong)] px-4 py-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0 text-gold"
          aria-hidden
        >
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <p className="text-[12.5px] leading-5 text-muted">
          <span className="font-semibold text-navy">We&apos;re still working on this.</span>{" "}
          Habit tracking works end-to-end today - streaks, reminders, and insights are coming soon.
        </p>
      </div>

      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <div className="flex items-center justify-between gap-2 border-b border-base pb-4">
          <div>
            <p className="text-sm font-semibold text-navy">This week</p>
            <p className="mt-0.5 text-[11px] text-faint">
              {totalDone} of {totalTarget} target completions
            </p>
          </div>
          <span className="rounded-full border border-line bg-tile px-3 py-1 text-[11px] font-semibold text-navy">
            {Math.round(overallPct)}%
          </span>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading your habits...</p>
        ) : error ? (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        ) : (
          <div className="mt-4 space-y-2">
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
                  className="group flex w-full items-center gap-4 rounded-[10px] border border-base bg-surface p-4 text-left transition hover:border-sealion"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-tile text-muted transition-colors ${
                      pressed ? "border-sealion text-gold" : "group-hover:text-navy"
                    }`}
                  >
                    <svg
                      width="17"
                      height="17"
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
                      <span className="truncate text-[13.5px] font-semibold text-navy">
                        {HABIT_LABELS[type]}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-faint">
                        {done} / {WEEKLY_TARGET}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                      {HABIT_DESCRIPTIONS[type]}
                    </span>
                    <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-sealion transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </span>

                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                      pressed
                        ? "border-sealion bg-gold text-on-accent"
                        : "border-line bg-tile text-faint"
                    }`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CornerFrame>
    </div>
  );
}
