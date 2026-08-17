/**
 * Compact statistic tile: big number + mono uppercase label + optional
 * supporting hint. Replaces the repeated stat-tile markup across the admin
 * home (snapshot, pipeline, enrollment, workload).
 */
export interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "gold" | "warn" | "muted";
  className?: string;
}

const VALUE_COLORS = {
  default: "text-navy",
  gold: "text-gold-token",
  warn: "text-warn",
  muted: "text-muted",
} as const;

export function Stat({ label, value, hint, tone = "default", className = "" }: StatProps) {
  return (
    <div className={`rounded-[8px] border border-line bg-tile px-3 py-2.5 ${className}`}>
      <p className={`text-lg font-bold leading-tight tabular-nums ${VALUE_COLORS[tone]}`}>{value}</p>
      <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-4 text-muted">{hint}</p>}
    </div>
  );
}
