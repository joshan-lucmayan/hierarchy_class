import type { Habit } from "@/lib/habitStore";
import { dayComplete, isScheduled, type EntryShape, type PauseShape } from "@/lib/habitLogic";

/** 0 = Mon .. 6 = Sun. */
export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** "Mon - Fri", "Every day", or "Mon, Wed, Sat". */
export function scheduleLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  // Collapse consecutive runs into ranges: [0,1,2,3,4] -> "Mon - Fri".
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < sorted.length; i++) {
    const isLast = i === sorted.length - 1;
    const broken = !isLast && sorted[i + 1] !== sorted[i] + 1;
    if (isLast || broken) {
      const s = DAY_SHORT[sorted[start]];
      const e = DAY_SHORT[sorted[i]];
      parts.push(start === i ? s : `${s} - ${e}`);
      start = i + 1;
    }
  }
  return parts.join(", ");
}

/** "5 times/week", "30 minutes/day", "8 hours/day", "4 times/week". */
export function targetLabel(habit: Habit): string {
  const unit = habit.targetUnit ?? (habit.goalType === "completion" || habit.goalType === "count" ? "times" : "");
  const per = habit.frequencyType === "weekly" ? "week" : "day";
  const value = Number(habit.targetValue);
  const amount =
    habit.goalType === "completion" || habit.goalType === "count"
      ? `${value} ${unit}`
      : `${value} ${unit}`;
  return `${amount}/${per}`;
}

/** "45 min", "8 h", "4 sessions" - used for entry values. */
export function formatAmount(value: number, habit: Habit): string {
  const unit = habit.targetUnit ?? "";
  if (unit === "minutes") return `${value} min`;
  if (unit === "hours") return `${value} h`;
  if (unit === "pages") return `${value} pages`;
  return unit ? `${value} ${unit}` : String(value);
}

/** Friendly goal description for the detail view. */
export function goalDescription(habit: Habit): string {
  const per = habit.frequencyType === "weekly" ? "per week" : "per day";
  return `${formatAmount(Number(habit.targetValue), habit)} ${per}`;
}

/**
 * Mark + token class for one day cell on the week grid / calendar:
 * complete, missed (a scheduled day that passed without a record), not
 * scheduled (or paused), future, or today.
 */
export function dayMark(
  habit: Habit,
  date: string,
  today: string,
  entries: EntryShape[],
  pauses: PauseShape[]
): { mark: string; cls: string } {
  if (dayComplete(habit, date, entries)) return { mark: "✓", cls: "text-accent" };
  const paused = pauses.some(
    (p) => p.habitId === habit.id && p.startedAt <= date && (p.endedAt === null || date <= p.endedAt)
  );
  if (paused || !isScheduled(habit, date)) return { mark: "·", cls: "text-faint/40" };
  if (date > today) return { mark: "○", cls: "text-faint/50" };
  if (date === today) return { mark: "○", cls: "text-navy" };
  return { mark: "✕", cls: "text-[var(--warn)]" };
}
