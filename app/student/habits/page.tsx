"use client";

import { useMemo, useState } from "react";
import { useHabits, type Habit } from "@/lib/habitStore";
import { toISODate, getCurrentWeek } from "@/lib/weekUtils";
import {
  weeklyStats,
  weekProgress,
  currentStreak,
  dayComplete,
  isScheduled,
} from "@/lib/habitLogic";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { HabitIcon } from "@/components/habits/HabitIcon";
import { HabitDetailModal } from "@/components/habits/HabitDetailModal";
import { HabitFormModal } from "@/components/habits/HabitFormModal";
import { HabitHistoryView } from "@/components/habits/HabitHistoryView";
import { DAY_LETTERS, scheduleLabel, targetLabel, dayMark } from "@/components/habits/habitFormat";

function StatCard({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: number }) {
  return (
    <CornerFrame className="rounded-[10px] border border-base bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11.5px] text-muted">{sub}</p>}
      {bar !== undefined && (
        <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-sealion" style={{ width: `${Math.round(bar * 100)}%` }} />
        </span>
      )}
    </CornerFrame>
  );
}

function isBinary(habit: Habit): boolean {
  return habit.goalType === "completion" || (habit.goalType === "count" && habit.frequencyType === "weekly");
}

function TodayRow({
  habit,
  today,
  onToggle,
  onSaveValue,
  busy,
  onError,
}: {
  habit: Habit;
  today: string;
  onToggle: (habitId: string) => void;
  onSaveValue: (habitId: string, value: number) => void;
  busy: boolean;
  onError: (msg: string) => void;
}) {
  const { entries } = useHabits();
  const done = dayComplete(habit, today, entries);
  const entry = entries.find((e) => e.habitId === habit.id && e.entryDate === today);
  const [draft, setDraft] = useState(entry ? String(entry.value) : "");
  const binary = isBinary(habit);

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-base bg-surface px-4 py-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-tile text-muted ${
          done ? "text-gold" : ""
        }`}
      >
        <HabitIcon icon={habit.icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-navy">{habit.name}</p>
        <p className="truncate text-[11.5px] text-muted">{targetLabel(habit)}</p>
      </div>

      {binary ? (
        <button
          type="button"
          onClick={() => onToggle(habit.id)}
          disabled={busy}
          aria-pressed={done}
          aria-label={`${habit.name} - ${done ? "done today" : "mark done today"}`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-60 ${
            done
              ? "border-sealion bg-gold text-on-accent"
              : "border-line bg-tile text-faint hover:border-sealion"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`${habit.name} amount for today`}
            placeholder={done && entry ? String(entry.value) : "0"}
            className="w-20 rounded-[8px] border border-line bg-tile px-2.5 py-1.5 text-[13px] tabular-nums text-navy outline-none focus:border-sealion"
          />
          {habit.targetUnit && <span className="text-[11.5px] text-faint">{habit.targetUnit}</span>}
          <button
            type="button"
            onClick={() => {
              const value = Number(draft);
              if (!draft || Number.isNaN(value) || value < 0) {
                onError("Enter a valid amount first.");
                return;
              }
              onSaveValue(habit.id, value);
            }}
            disabled={busy}
            className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent disabled:opacity-60"
          >
            {done ? "Update" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentHabitsPage() {
  const {
    habits,
    archivedHabits,
    entries,
    pauses,
    loading,
    error,
    refetch,
    addHabit,
    toggleDay,
    recordEntry,
    restoreHabit,
    deleteHabit,
  } = useHabits();
  const today = toISODate(new Date());
  const { start, end, days } = getCurrentWeek();

  const [selected, setSelected] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const active = useMemo(() => habits.filter((h) => h.status === "active"), [habits]);
  // Keep the detail modal in sync with the store: after edit/pause the modal
  // must show the fresh habit; after archive/delete the habit leaves `habits`
  // and the modal closes itself instead of lingering on stale state.
  const selectedLive = selected ? habits.find((h) => h.id === selected.id) ?? null : null;
  const stats = useMemo(
    () => weeklyStats(habits, pauses, entries, start, end, today),
    [habits, pauses, entries, start, end, today]
  );
  const bestHabit = stats.best ? habits.find((h) => h.id === stats.best!.habit.id) ?? null : null;
  const dueToday = active.filter((h) => isScheduled(h, today));
  const doneToday = dueToday.filter((h) => dayComplete(h, today, entries)).length;

  const progressOf = (habit: Habit) => weekProgress(habit, entries, start, end);

  async function run(action: () => Promise<string | null>, habitId: string) {
    setBusyId(habitId);
    setActionError(null);
    const err = await action();
    if (err) setActionError(err);
    setBusyId(null);
  }

  const weekLabel = `${formatShort(start)} - ${formatShort(end)}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-line/40" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[10px] border border-base bg-surface" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-[10px] border border-base bg-surface" />
        <div className="h-72 animate-pulse rounded-[10px] border border-base bg-surface" />
      </div>
    );
  }

  if (error) {
    return (
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-navy">Unable to load your habits.</p>
        <p className="mt-1 text-xs text-muted">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 rounded-full bg-navy px-5 py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
        >
          Retry
        </button>
      </CornerFrame>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label mb-1">Habit Tracker</p>
          <h1 className="font-display text-2xl font-bold text-navy">Build consistent habits, one week at a time.</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            Personal routines - separate from your grades. Nothing here touches your rank.
          </p>
        </div>
        <p className="text-[12px] font-medium text-faint">Week of {weekLabel}</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Weekly completion" value={`${Math.round(stats.pct * 100)}%`} bar={stats.pct} sub={`${stats.completed} of ${stats.target} targets`} />
        <StatCard label="Targets completed" value={String(stats.completed)} sub={`${stats.remaining} remaining`} />
        <StatCard
          label="Active habits"
          value={String(active.length)}
          sub={bestHabit ? `Best: ${bestHabit.name}` : "No habits yet"}
        />
        <StatCard
          label="Best habit"
          value={bestHabit ? bestHabit.name : "-"}
          sub={stats.best ? `${Math.round(stats.best.progress.pct * 100)}% this week` : "Log something to find out"}
          bar={stats.best?.progress.pct}
        />
      </div>

      {actionError && (
        <p className="rounded-lg border border-red-300 bg-red-500/5 px-4 py-2.5 text-xs font-medium text-red-600">
          {actionError}
        </p>
      )}

      {/* Today */}
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-label">Today</h2>
          <span className="text-[11.5px] text-faint">
            {doneToday} of {dueToday.length} due today
          </span>
        </div>
        {dueToday.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing scheduled for today. Enjoy the break.</p>
        ) : (
          <div className="mt-3.5 space-y-2">
            {dueToday.map((habit) => (
              <TodayRow
                key={habit.id}
                habit={habit}
                today={today}
                busy={busyId === habit.id}
                onToggle={(id) => run(() => toggleDay(id, today), id)}
                onSaveValue={(id, value) => run(() => recordEntry(id, today, value), id)}
                onError={setActionError}
              />
            ))}
          </div>
        )}
      </CornerFrame>

      {/* This week grid */}
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-label">This week</h2>
          <span className="text-[11.5px] text-faint">Mon - Sun</span>
        </div>
        {habits.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No habits yet - add one below.</p>
        ) : (
          <div className="mt-3.5 overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1.4fr_repeat(7,1fr)] items-center gap-1 px-1 pb-2">
                <span />
                {DAY_LETTERS.map((l, i) => (
                  <span key={`${l}-${i}`} className="text-center text-[9.5px] font-semibold uppercase tracking-wide text-faint">
                    {l}
                  </span>
                ))}
              </div>
              <div className="space-y-1">
                {habits.map((habit) => {
                  const wp = progressOf(habit);
                  const paused = habit.status === "paused";
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={() => setSelected(habit)}
                      className={`grid w-full grid-cols-[1.4fr_repeat(7,1fr)] items-center gap-1 rounded-[8px] px-1 py-2 text-left transition hover:bg-[var(--surface-strong)] ${
                        paused ? "opacity-60" : ""
                      }`}
                      aria-label={`${habit.name} - ${wp.completed} of ${wp.target} this week`}
                    >
                      <span className="min-w-0 pr-2">
                        <span className="block truncate text-[12.5px] font-semibold text-navy">{habit.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-line">
                            <span
                              className="block h-full rounded-full bg-sealion"
                              style={{ width: `${Math.round(wp.pct * 100)}%` }}
                            />
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-faint">
                            {wp.completed}/{wp.target}
                          </span>
                        </span>
                      </span>
                      {days.map((d) => {
                        const m = dayMark(habit, d.date, today, entries, pauses);
                        return (
                          <span
                            key={d.date}
                            className={`flex h-7 items-center justify-center rounded-[6px] text-[12px] font-bold ${
                              d.date === today ? "border border-sealion text-navy" : m.cls
                            }`}
                          >
                            {m.mark}
                          </span>
                        );
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CornerFrame>

      {/* Habits list */}
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="section-label">Habits</h2>
            <p className="mt-1 text-[11.5px] text-muted">
              Click a habit for details, history, and pause/archive. Paused habits are never required or counted as missed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add habit
          </button>
        </div>

        {habits.length === 0 ? (
          <div className="mt-6 rounded-[10px] border border-dashed border-line bg-[var(--surface-strong)] p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-tile text-muted">
              <HabitIcon icon="custom" size={20} />
            </span>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">No active habits</p>
            <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-5 text-muted">
              Build your routine. Start with one small habit and stay consistent.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-4 rounded-full bg-navy px-5 py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
            >
              Add your first habit
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {habits.map((habit) => {
              const wp = progressOf(habit);
              const streak = currentStreak(habit, pauses, entries, today);
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => setSelected(habit)}
                  className={`group flex w-full items-center gap-3 rounded-[10px] border border-base bg-surface p-4 text-left transition hover:border-sealion ${
                    habit.status === "paused" ? "opacity-70" : ""
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-tile text-muted">
                    <HabitIcon icon={habit.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-navy">{habit.name}</span>
                      <span className="rounded-full border border-line px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-faint">
                        {habit.category}
                      </span>
                      {habit.status === "paused" && (
                        <span className="rounded-full border border-line px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted">
                          Paused
                        </span>
                      )}
                    </span>
                    <span className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[11.5px] text-muted">
                        {targetLabel(habit)} · {scheduleLabel(habit.scheduledDays)}
                      </span>
                      <span className="shrink-0 text-[10.5px] tabular-nums text-faint">
                        {wp.completed}/{wp.target} this week · {streak}-day streak
                      </span>
                    </span>
                    <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-sealion transition-all duration-300"
                        style={{ width: `${Math.round(wp.pct * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-faint transition group-hover:text-navy">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CornerFrame>

      {/* Archived habits - soft-deleted, restorable here */}
      {archivedHabits.length > 0 && (
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-label">Archived</h2>
            <span className="text-[11.5px] text-faint">{archivedHabits.length} hidden</span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted">
            Archived habits keep their history. Restore to track again, or delete forever.
          </p>
          <div className="mt-3.5 space-y-2">
            {archivedHabits.map((habit) => {
              const confirming = confirmDeleteId === habit.id;
              return (
                <div
                  key={habit.id}
                  className="flex items-center gap-3 rounded-[10px] border border-base bg-surface px-4 py-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-tile text-muted opacity-60">
                    <HabitIcon icon={habit.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="truncate text-[13.5px] font-semibold text-navy">{habit.name}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                      {targetLabel(habit)} · {scheduleLabel(habit.scheduledDays)}
                    </span>
                  </span>
                  {confirming ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[11.5px] text-muted">Delete forever?</span>
                      <button
                        type="button"
                        onClick={() => run(() => deleteHabit(habit.id), habit.id)}
                        disabled={busyId === habit.id}
                        className="rounded-full bg-[var(--warn)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {busyId === habit.id ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:border-sealion"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => run(() => restoreHabit(habit.id), habit.id)}
                        disabled={busyId === habit.id}
                        className="rounded-full bg-navy px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-gold hover:text-on-accent disabled:opacity-60"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(habit.id)}
                        className="rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:border-[var(--warn)] hover:text-[var(--warn)]"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CornerFrame>
      )}

      {/* History */}
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <h2 className="section-label">History</h2>
        <p className="mt-1 text-[11.5px] text-muted">
          Checked = completed, cross = a scheduled day that passed without a record. Paused days are not scheduled.
        </p>
        <div className="mt-4">
          <HabitHistoryView habits={habits} entries={entries} pauses={pauses} />
        </div>
      </CornerFrame>

      {/* Modals */}
      {selectedLive && <HabitDetailModal habit={selectedLive} onClose={() => setSelected(null)} />}
      {creating && (
        <HabitFormModal habit={undefined} onClose={() => setCreating(false)} onSave={addHabit} />
      )}
    </div>
  );
}

function formatShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
