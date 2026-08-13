/**
 * Local-timezone week helpers for the student dashboard.
 *
 * The rest of the app treats dates in the user's local timezone (dates are
 * rendered with toLocaleDateString and never shifted to UTC - see
 * components/feed/FeedPost.tsx and app/admin/home/page.tsx). Entry dates
 * stored in the DB are plain YYYY-MM-DD values, so we build ISO strings from
 * LOCAL date components (never Date.toISOString, which would shift by the UTC
 * offset) to keep bucketing aligned with what the user sees on screen.
 */

export interface WeekDay {
  /** ISO date (YYYY-MM-DD) in local time - the key used to match DB rows. */
  date: string;
  /** Single-letter weekday label (M T W T F S S). */
  label: string;
}

/** Monday of the week containing `now`, at local midnight. */
export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = d.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = dow === 0 ? -6 : 1 - dow; // days back to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

/** ISO date string (YYYY-MM-DD) from LOCAL components - never UTC. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday-Sunday bounds + the 7 day objects for the week containing `now`. */
export function getCurrentWeek(
  now: Date = new Date()
): { start: string; end: string; days: WeekDay[] } {
  const start = startOfWeek(now);
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({ date: toISODate(d), label: WEEKDAY_LABELS[i] });
  }
  return { start: days[0].date, end: days[6].date, days };
}
