/** Overdue fine charged per calendar day past the due date (PHP). */
export const FINE_PER_DAY = 10;

/** Whole-day difference (a - b) using local midnight boundaries. */
function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO.slice(0, 10) + "T00:00:00").getTime();
  const b = new Date(toISO.slice(0, 10) + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Overdue days relative to today; never negative. */
export function overdueDays(dueISO?: string): number {
  if (!dueISO) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return Math.max(0, diffDays(dueISO, today));
}

/** Fine for an overdue book as of a given end date (defaults to today). */
export function fineFor(dueISO: string | undefined, endISO?: string): number {
  if (!dueISO) return 0;
  const end = endISO ?? new Date().toISOString().slice(0, 10);
  return Math.max(0, diffDays(dueISO, end)) * FINE_PER_DAY;
}

/** "₱30" or "₱30.50" style peso formatting. */
export function formatPeso(amount: number): string {
  return `₱${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
}

/** Fine line for a currently-borrowed book, e.g. "Overdue 3 days · ₱30". */
export function overdueLine(dueISO?: string): string | null {
  const days = overdueDays(dueISO);
  if (days <= 0) return null;
  return `Overdue ${days} day${days === 1 ? "" : "s"} · ${formatPeso(fineFor(dueISO))}`;
}
