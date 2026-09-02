/**
 * Thin progress bar (semester progress, rank mean, course performance).
 * Track is `bg-line`, fill is a theme token - kept visually thin by design.
 */
export interface BarProps {
  /** 0-100 */
  value: number;
  tone?: "accent" | "sealion" | "warn" | "muted";
  size?: "sm" | "md";
  className?: string;
}

const TONES = {
  accent: "bg-accent-token",
  sealion: "bg-sealion",
  warn: "bg-warn",
  muted: "bg-muted",
} as const;

export function Bar({ value, tone = "accent", size = "sm", className = "" }: BarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className={`overflow-hidden rounded-full bg-line ${size === "sm" ? "h-1.5" : "h-2"} ${className}`}>
      <div
        className={`h-full rounded-full ${TONES[tone]} transition-all duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
