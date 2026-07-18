import { StatCategory } from "@/types/student";

const CATEGORY_BG: Record<StatCategory, string> = {
  academic: "bg-stat-academic",
  physical: "bg-stat-physical",
  charisma: "bg-stat-charisma",
};

interface StatBarProps {
  label: string;
  value: number; // 0-100
  category: StatCategory;
}

export function StatBar({ label, value, category }: StatBarProps) {
  const colorClass = CATEGORY_BG[category];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-navy">{label}</span>
        <span className="font-medium text-slate-500">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
