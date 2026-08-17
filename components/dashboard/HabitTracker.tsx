"use client";

import { useState } from "react";
import Link from "next/link";
import { useHabits, type Habit } from "@/lib/habitStore";
import { toISODate, getCurrentWeek } from "@/lib/weekUtils";
import { weekProgress, dayComplete, isScheduled } from "@/lib/habitLogic";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { HabitIcon } from "@/components/habits/HabitIcon";
import { targetLabel } from "@/components/habits/habitFormat";

function isBinary(habit: Habit): boolean {
  return habit.goalType === "completion" || (habit.goalType === "count" && habit.frequencyType === "weekly");
}

/**
 * Compact weekly habit tracker for the student home right column. Rows come
 * from the student's real habits (the five defaults plus any customs), each
 * showing its weekly progress; the check button toggles today for binary
 * habits, value-based habits link to the full tracker to log amounts. Clicking
 * a row opens the habits page.
 */
export default function HabitTracker() {
  const { habits, entries, loading, error, toggleDay } = useHabits();
  const today = toISODate(new Date());
  const { start, end } = getCurrentWeek();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const active = habits.filter((h) => h.status === "active");

  async function toggle(habitId: string) {
    setBusyId(habitId);
    setActionError(null);
    const err = await toggleDay(habitId, today);
    if (err) setActionError(err);
    setBusyId(null);
  }

  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-label">Habit Tracker</h2>
        <Link
          href="/student/habits"
          className="shrink-0 text-[11px] font-semibold text-gold transition hover:underline"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-line/40" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-warn">{error}</p>
      ) : active.length === 0 ? (
        <p className="mt-4 text-[12.5px] leading-5 text-muted">
          No active habits.{" "}
          <Link href="/student/habits" className="font-semibold text-gold hover:underline">
            Start one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-3.5 space-y-3.5">
          {active.slice(0, 5).map((habit) => {
            const wp = weekProgress(habit, entries, start, end);
            const done = dayComplete(habit, today, entries);
            const binary = isBinary(habit);
            return (
              <div key={habit.id} className="flex items-center gap-3">
                <Link
                  href="/student/habits"
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                  aria-label={`${habit.name} - ${wp.completed} of ${wp.target} this week`}
                >
                  <span
                    className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-line bg-tile text-muted transition-colors ${
                      done ? "text-gold" : "group-hover:text-navy"
                    }`}
                  >
                    <HabitIcon icon={habit.icon} size={15} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium text-navy">{habit.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-faint">
                        {wp.completed} / {wp.target}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-sealion transition-all duration-300"
                        style={{ width: `${Math.round(wp.pct * 100)}%` }}
                      />
                    </span>
                  </span>
                </Link>

                {binary && isScheduled(habit, today) && (
                  <button
                    type="button"
                    onClick={() => toggle(habit.id)}
                    disabled={busyId === habit.id}
                    aria-pressed={done}
                    aria-label={`${habit.name} - ${done ? "done today" : "mark done today"}`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-60 ${
                      done
                        ? "border-sealion bg-gold text-on-accent"
                        : "border-line bg-tile text-faint hover:border-sealion"
                    }`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </button>
                )}
                {!binary && (
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-faint">
                    {targetLabel(habit).split("/")[0]}
                  </span>
                )}
              </div>
            );
          })}
          {actionError && (
            <p className="mt-2 rounded-md border border-warn-soft bg-warn-soft px-2.5 py-1.5 text-[11px] text-warn">
              {actionError}
            </p>
          )}
        </div>
      )}
    </CornerFrame>
  );
}
