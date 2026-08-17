/**
 * Theme-safe status chip. All variants resolve to tokens (never hardcoded
 * emerald/blue/red), so Pending / Approved / Rejected / Teacher / counts
 * read correctly in both Midnight and Rose. Urgency comes from the tone, not
 * from brighter reds.
 */
export interface ChipProps {
  variant?: "neutral" | "gold" | "success" | "warn" | "danger";
  children: React.ReactNode;
  className?: string;
}

const VARIANTS = {
  neutral: "border border-base bg-tile text-muted",
  gold: "border border-gold-soft bg-gold-soft text-gold-token",
  success: "border border-gold-soft bg-gold-soft text-gold-token",
  warn: "border border-warn-soft bg-warn-soft text-warn",
  danger: "border border-warn-soft bg-warn-soft text-warn",
} as const;

export function Chip({ variant = "neutral", children, className = "" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
