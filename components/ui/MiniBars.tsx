/**
 * Compact bar-trend chart (the reusable 7-day pattern from WeeklyProgress).
 * No chart library - pure divs in the app's visual language, used by the
 * grade pipeline and anywhere a small time series belongs.
 */
export interface MiniBarsProps {
  data: { label: string; value: number }[];
  height?: number;
  tone?: "sealion" | "gold";
  ariaLabel?: string;
}

export function MiniBars({ data, height = 56, tone = "sealion", ariaLabel = "Trend over time" }: MiniBarsProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fill = tone === "gold" ? "bg-gold-token" : "bg-sealion";
  return (
    <div className="flex items-end gap-1.5" role="img" aria-label={ariaLabel}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center justify-end" style={{ height }}>
          <span className="text-[10px] font-semibold tabular-nums text-muted">{d.value}</span>
          <div
            className={`mt-1 w-full rounded-t-[3px] ${d.value > 0 ? fill : "bg-line"}`}
            style={{ height: `${Math.max((d.value / max) * (height - 26), d.value > 0 ? 5 : 3)}px` }}
          />
          <p className="mt-1 text-[9.5px] font-medium text-faint">{d.label}</p>
        </div>
      ))}
    </div>
  );
}
