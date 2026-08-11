import type { EffectiveEnrollment } from "@/lib/useEnrollment";

const HEX_CLIP = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

const CONFIG: Record<EffectiveEnrollment, { label: string; color: string; sub: string }> = {
  enrolled: { label: "ENROLLED", color: "#c9962c", sub: "Active" },
  expired: { label: "EXPIRED", color: "#b45309", sub: "Renewal required" },
  revoked: { label: "REVOKED", color: "#dc2626", sub: "Contact admin" },
  unknown: { label: "UNKNOWN", color: "#6b7280", sub: "Pending enrollment" },
};

export function EnrollmentBadge({
  status,
  expiresAt,
  size = "md",
}: {
  status: EffectiveEnrollment;
  expiresAt?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const cfg = CONFIG[status];
  const dims = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-11 w-11" : "h-16 w-16";
  const font = size === "lg" ? "text-[10px]" : size === "sm" ? "text-[6px]" : "text-[8px]";

  const expiryLabel = status === "enrolled" && expiresAt
    ? `Until ${new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : cfg.sub;

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex ${dims} shrink-0 flex-col items-center justify-center border-2 bg-navy`}
        style={{ clipPath: HEX_CLIP, borderColor: cfg.color }}
      >
        <span className={`${font} font-bold leading-tight tracking-[0.08em] text-white`}>{cfg.label}</span>
        <span className={`${font} font-semibold`} style={{ color: cfg.color }}>
          {cfg.sub}
        </span>
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-navy">{cfg.label}</p>
        <p className="mt-0.5 text-[11px] text-muted">{expiryLabel}</p>
      </div>
    </div>
  );
}
