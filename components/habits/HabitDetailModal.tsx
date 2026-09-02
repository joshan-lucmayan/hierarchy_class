"use client";

import { useMemo, useState, useEffect } from "react";
import { useHabits, type Habit } from "@/lib/habitStore";
import { toISODate, getCurrentWeek } from "@/lib/weekUtils";
import {
  weekProgress,
  currentStreak,
  bestStreak,
  completionRate,
  dayComplete,
  isScheduled,
} from "@/lib/habitLogic";
import { HabitIcon } from "@/components/habits/HabitIcon";
import { HabitFormModal } from "@/components/habits/HabitFormModal";
import { DAY_LETTERS, scheduleLabel, targetLabel, formatAmount } from "@/components/habits/habitFormat";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-tile px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-bold text-navy">{value}</p>
    </div>
  );
}

/**
 * Habit details: target, schedule, this week, historical completion rate,
 * current + best streak, a Mon-Sun strip, a log-today control, and the
 * edit / pause-resume / archive actions. Pausing opens a pause window (its
 * days stop counting and never break the streak); archiving soft-deletes.
 */
export function HabitDetailModal({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const {
    entries,
    pauses,
    pauseHabit,
    resumeHabit,
    archiveHabit,
    deleteHabit,
    recordEntry,
    toggleDay,
    updateHabit,
  } = useHabits();
  const today = toISODate(new Date());
  const { start, end, days } = getCurrentWeek();

  const [editing, setEditing] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => {
    const e = entries.find((x) => x.habitId === habit.id && x.entryDate === today);
    return e ? String(e.value) : "";
  });

  useEffect(() => {
    const e = entries.find((x) => x.habitId === habit.id && x.entryDate === today);
    setDraft(e ? String(e.value) : "");
  }, [habit.id, entries, today]);

  const entriesForHabit = useMemo(
    () => entries.filter((e) => e.habitId === habit.id),
    [entries, habit.id]
  );

  const wp = weekProgress(habit, entriesForHabit, start, end, pauses);
  const streak = currentStreak(habit, pauses, entriesForHabit, today);
  const best = bestStreak(habit, pauses, entriesForHabit, today);
  const rate = completionRate(habit, pauses, entriesForHabit, today);
  const todayEntry = entriesForHabit.find((e) => e.entryDate === today);
  const todayDone = dayComplete(habit, today, entriesForHabit);
  const dueToday = isScheduled(habit, today) && habit.status === "active";
  const isValueGoal =
    habit.goalType === "duration" ||
    habit.goalType === "quantity" ||
    (habit.goalType === "count" && habit.frequencyType === "daily");

  async function run(action: () => Promise<string | null>, key: string) {
    setBusy(key);
    setError(null);
    const err = await action();
    if (err) setError(err);
    setBusy(null);
  }

  async function saveValue() {
    const value = Number(draft);
    if (!draft || Number.isNaN(value) || value < 0) {
      setError("Enter a valid amount.");
      return;
    }
    await run(() => recordEntry(habit.id, today, value), "value");
  }

  const binaryDone = !isValueGoal && todayDone;
  const todayLabel = habit.goalType === "completion"
    ? "Mark today complete"
    : habit.goalType === "count"
      ? "Log one session"
      : "Save";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
      }}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-base bg-surface p-6"
        style={{ maxHeight: "min(90vh, 90dvh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-tile text-muted ${
                habit.status === "paused" ? "opacity-60" : ""
              }`}
            >
              <HabitIcon icon={habit.icon} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-navy">{habit.name}</h2>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-faint">
                  {targetLabel(habit)}
                </span>
                {habit.status === "paused" && (
                  <span className="rounded-full border border-line px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted">
                    Paused
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-faint transition hover:border-sealion hover:text-navy"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {habit.description && <p className="mt-3 text-[12.5px] leading-5 text-muted">{habit.description}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Target" value={targetLabel(habit)} />
          <Stat label="Schedule" value={scheduleLabel(habit.scheduledDays)} />
          <Stat label="This week" value={`${wp.completed} / ${wp.target}`} />
          <Stat label="Completion" value={`${Math.round(rate * 100)}%`} />
          <Stat label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
          <Stat label="Best streak" value={`${best} day${best === 1 ? "" : "s"}`} />
        </div>

        {/* Mon-Sun strip for the current week */}
        <div className="mt-4 flex items-center justify-between gap-1 rounded-[8px] border border-line bg-tile px-3 py-3">
          {days.map((d) => {
            const complete = dayComplete(habit, d.date, entriesForHabit);
            const scheduled = isScheduled(habit, d.date);
            const future = d.date > today;
            let cls = "text-faint";
            let mark = scheduled ? "○" : "·";
            if (complete) {
              cls = "text-gold";
              mark = "✓";
            } else if (scheduled && !future && d.date !== today) {
              cls = "text-[var(--warn)]";
              mark = "✕";
            } else if (d.date === today) {
              cls = "text-navy";
              mark = scheduled ? "○" : "·";
            } else if (future) {
              cls = "text-faint/50";
              mark = scheduled ? "○" : "·";
            }
            return (
              <div key={d.date} className="flex flex-col items-center gap-1" title={d.date}>
                <span className="text-[9.5px] font-semibold uppercase tracking-wide text-faint">{d.label}</span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${
                    d.date === today ? "border border-sealion" : ""
                  } ${cls}`}
                >
                  {mark}
                </span>
              </div>
            );
          })}
        </div>

        {/* Log today */}
        {dueToday && (
          <div className="mt-4 rounded-[8px] border border-base bg-[var(--surface-strong)] p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Today</p>
            {isValueGoal ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label={`${habit.name} amount for today`}
                    className="w-24 rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-sealion"
                  />
                  <span className="text-xs text-muted">{habit.targetUnit ?? ""}</span>
                </div>
                <button
                  type="button"
                  onClick={saveValue}
                  disabled={busy === "value"}
                  className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover-bg-gold-token hover-text-on-accent disabled:opacity-60"
                >
                  {busy === "value" ? "Saving..." : "Save"}
                </button>
                {todayEntry && todayEntry.value > 0 && (
                  <span className="text-[11.5px] text-muted">
                    Logged: {formatAmount(todayEntry.value, habit)}
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => run(() => toggleDay(habit.id, today), "toggle")}
                disabled={busy === "toggle"}
                aria-pressed={binaryDone}
                className={`mt-2 rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                  binaryDone
                    ? "border border-sealion bg-gold text-on-accent"
                    : "bg-navy text-white hover-bg-gold-token hover-text-on-accent"
                }`}
              >
                {busy === "toggle" ? "Saving..." : binaryDone ? "Done today ✓" : todayLabel}
              </button>
            )}
            {error && <p className="mt-2 text-xs text-warn">{error}</p>}
          </div>
        )}

        {error && !dueToday && <p className="mt-3 text-xs text-warn">{error}</p>}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-base pt-4">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-navy transition hover:border-sealion"
          >
            Edit
          </button>
          {habit.status === "paused" ? (
            <button
              type="button"
              onClick={() => run(() => resumeHabit(habit.id), "status")}
              disabled={busy === "status"}
              className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-navy transition hover:border-sealion disabled:opacity-60"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => run(() => pauseHabit(habit.id), "status")}
              disabled={busy === "status"}
              className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-navy transition hover:border-sealion disabled:opacity-60"
            >
              Pause
            </button>
          )}
          {confirmingDelete ? (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-muted">Delete forever?</span>
              <button
                type="button"
                onClick={() => run(async () => {
                  const err = await deleteHabit(habit.id);
                  if (!err) onClose();
                  return err;
                }, "delete")}
                disabled={busy === "delete"}
                className="rounded-full bg-[var(--warn)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy === "delete" ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted transition hover:border-sealion"
              >
                Keep
              </button>
            </span>
          ) : confirmingArchive ? (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-muted">Archive this habit?</span>
              <button
                type="button"
                onClick={() => run(() => archiveHabit(habit.id), "archive")}
                disabled={busy === "archive"}
                className="rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white transition hover-bg-gold-token hover-text-on-accent disabled:opacity-60"
              >
                {busy === "archive" ? "Archiving..." : "Archive"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingArchive(false)}
                className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted transition hover:border-sealion"
              >
                Keep
              </button>
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmingArchive(true)}
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:border-sealion hover:text-navy"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="ml-auto rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:border-[var(--warn)] hover:text-[var(--warn)]"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <HabitFormModal habit={habit} onClose={() => setEditing(false)} onSave={updateHabit} />
      )}
    </div>
  );
}
