/**
 * Pure habit-tracking math, shared by the HabitProvider, the student habits
 * page, and the home dashboard widget. No React, no Supabase - unit-tested
 * with node:test (lib/habitLogic.test.ts).
 *
 * Conventions:
 * - Dates are plain YYYY-MM-DD strings in the user's local timezone (the app
 *   never shifts them to UTC - see lib/weekUtils.ts).
 * - Weekday index: 0 = Monday .. 6 = Sunday (Monday-first week).
 * - Entries: one row per (student, habit, date). For 'completion'/'count'
 *   goals the row's `value` is the units logged that day (1 for a simple
 *   check-off); for 'duration'/'quantity' goals it is the recorded amount.
 */

export type GoalType = "completion" | "count" | "duration" | "quantity";
export type FrequencyType = "daily" | "weekly";
export type HabitStatus = "active" | "paused" | "archived";

export interface HabitShape {
  id: string;
  goalType: GoalType;
  targetValue: number;
  frequencyType: FrequencyType;
  /** 0=Mon .. 6=Sun - which weekdays this habit is scheduled on. */
  scheduledDays: number[];
  status: HabitStatus;
}

export interface EntryShape {
  habitId: string;
  /** YYYY-MM-DD (local). */
  entryDate: string;
  value: number;
}

export interface PauseShape {
  habitId: string;
  /** YYYY-MM-DD (local). */
  startedAt: string;
  /** null while the pause is still open. */
  endedAt: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD into a local Date (never UTC). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 0=Mon .. 6=Sun for a YYYY-MM-DD date. */
export function weekdayIndex(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function isScheduled(habit: HabitShape, iso: string): boolean {
  return habit.scheduledDays.includes(weekdayIndex(iso));
}

/** One entry per habit per day - return the day's row if present. */
export function entryOn(habitId: string, iso: string, entries: EntryShape[]): EntryShape | undefined {
  // Entries are few per student; a linear scan is fine and avoids a Map on
  // every call. (Callers that need it hot can pre-index.)
  return entries.find((e) => e.habitId === habitId && e.entryDate === iso);
}

/**
 * Did this habit count as "done" on a specific day?
 * - daily frequency: the recorded value met the per-day target.
 * - weekly frequency: the day was logged at all (value >= 1) - the weekly sum
 *   decides progress, not any single day.
 */
export function dayComplete(
  habit: HabitShape,
  iso: string,
  entries: EntryShape[]
): boolean {
  const entry = entryOn(habit.id, iso, entries);
  if (!entry) return false;
  if (habit.frequencyType === "weekly") return entry.value >= 1;
  return entry.value >= habit.targetValue;
}

export interface WeekProgress {
  /** Completed units: for weekly habits, min(sum, target); for daily habits,
   *  the count of scheduled days that were completed. */
  completed: number;
  /** Target units: for weekly habits, target_value; for daily habits, the
   *  number of scheduled days in the week. */
  target: number;
  /** 0..1 fraction (completed / target, never above 1). */
  pct: number;
}

/** Progress for one habit across a Monday-Sunday week window. */
export function weekProgress(
  habit: HabitShape,
  entries: EntryShape[],
  weekStart: string,
  weekEnd: string,
  pauses: PauseShape[] = []
): WeekProgress {
  if (habit.frequencyType === "weekly") {
    let sum = 0;
    let d = weekStart;
    while (d <= weekEnd) {
      const e = entryOn(habit.id, d, entries);
      if (e) sum += e.value;
      d = addDays(d, 1);
    }
    const target = habit.targetValue;
    return {
      completed: Math.min(sum, target),
      target,
      pct: target > 0 ? Math.min(sum / target, 1) : 0,
    };
  }

  // Daily frequency: completed scheduled days / scheduled days in the week.
  // Paused days are treated as not scheduled - they are neither required nor
  // missed, so they drop out of both the numerator and the denominator.
  let scheduled = 0;
  let done = 0;
  let d = weekStart;
  while (d <= weekEnd) {
    if (isScheduled(habit, d) && !isPausedOn(pauses, habit.id, d)) {
      scheduled += 1;
      if (dayComplete(habit, d, entries)) done += 1;
    }
    d = addDays(d, 1);
  }
  return {
    completed: done,
    target: scheduled,
    pct: scheduled > 0 ? done / scheduled : 0,
  };
}

/** True when `iso` falls inside a pause window for this habit. */
export function isPausedOn(pauses: PauseShape[], habitId: string, iso: string): boolean {
  return pauses.some(
    (p) => p.habitId === habitId && p.startedAt <= iso && (p.endedAt === null || iso <= p.endedAt)
  );
}

/**
 * All scheduled dates from the earliest entry (or 365 days back) up to today.
 * Dates inside a pause window are excluded - while paused a habit neither
 * accrues missed days nor breaks its streak.
 */
export function scheduledDatesUpTo(
  habit: HabitShape,
  pauses: PauseShape[],
  entries: EntryShape[],
  today: string
): string[] {
  const earliest = entries
    .filter((e) => e.habitId === habit.id)
    .reduce<string | null>((min, e) => (min === null || e.entryDate < min ? e.entryDate : min), null);
  const start = earliest ?? addDays(today, -365);
  const dates: string[] = [];
  let d = start;
  while (d <= today) {
    if (isScheduled(habit, d) && !isPausedOn(pauses, habit.id, d)) dates.push(d);
    d = addDays(d, 1);
  }
  return dates;
}

/**
 * Current streak in consecutive SCHEDULED days. Today counts as part of the
 * streak when it is already complete; a scheduled-but-still-pending today does
 * NOT break the streak (the day has not passed yet). Any missed scheduled day
 * before today breaks it. Non-scheduled days are skipped entirely, so skipping
 * an unscheduled Saturday never breaks a Mon-Fri streak.
 */
export function currentStreak(
  habit: HabitShape,
  pauses: PauseShape[],
  entries: EntryShape[],
  today: string
): number {
  const dates = scheduledDatesUpTo(habit, pauses, entries, today);
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = dates[i];
    if (dayComplete(habit, d, entries)) {
      streak += 1;
    } else if (d === today) {
      continue; // today scheduled but still pending - keep the run alive
    } else {
      break;
    }
  }
  return streak;
}

/** Longest run of consecutive scheduled days ever completed. */
export function bestStreak(
  habit: HabitShape,
  pauses: PauseShape[],
  entries: EntryShape[],
  today: string
): number {
  const dates = scheduledDatesUpTo(habit, pauses, entries, today);
  let best = 0;
  let run = 0;
  for (const d of dates) {
    if (dayComplete(habit, d, entries)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * Historical completion rate: completed scheduled days / scheduled days that
 * have already passed (today counts only once it is complete; paused days and
 * future days are excluded).
 */
export function completionRate(
  habit: HabitShape,
  pauses: PauseShape[],
  entries: EntryShape[],
  today: string
): number {
  const dates = scheduledDatesUpTo(habit, pauses, entries, today).filter(
    (d) => d < today || (d === today && dayComplete(habit, d, entries))
  );
  if (dates.length === 0) return 0;
  const done = dates.filter((d) => dayComplete(habit, d, entries)).length;
  return done / dates.length;
}

export interface HabitWeekly {
  habit: HabitShape;
  progress: WeekProgress;
  currentStreak: number;
}

/**
 * Aggregate stats for the week header (spec section 8):
 * - completion pct weighted across habits (sum completed / sum targets)
 * - total completed targets and remaining targets
 * - the best-performing habit this week (highest pct, then most completed)
 */
export function weeklyStats(
  habits: HabitShape[],
  pauses: PauseShape[],
  entries: EntryShape[],
  weekStart: string,
  weekEnd: string,
  today: string
): {
  pct: number;
  completed: number;
  target: number;
  remaining: number;
  best: HabitWeekly | null;
  rows: HabitWeekly[];
} {
  // Only ACTIVE habits count toward the weekly aggregate: paused habits are
  // neither required today nor missed (spec section 13). Archived habits are
  // never loaded by the store anyway.
  const rows: HabitWeekly[] = habits
    .filter((h) => h.status === "active")
    .map((habit) => ({
      habit,
      progress: weekProgress(habit, entries, weekStart, weekEnd, pauses),
      currentStreak: currentStreak(habit, pauses, entries, today),
    }));

  const completed = rows.reduce((s, r) => s + r.progress.completed, 0);
  const target = rows.reduce((s, r) => s + r.progress.target, 0);

  let best: HabitWeekly | null = null;
  for (const r of rows) {
    if (r.progress.pct <= 0) continue;
    if (!best) {
      best = r;
      continue;
    }
    if (r.progress.pct > best.progress.pct) best = r;
    else if (r.progress.pct === best.progress.pct && r.progress.completed > best.progress.completed) best = r;
  }

  return {
    pct: target > 0 ? Math.min(completed / target, 1) : 0,
    completed,
    target,
    remaining: Math.max(target - completed, 0),
    best,
    rows,
  };
}
