import type { EffectiveEnrollment } from "@/lib/useEnrollment";

/**
 * Student-facing enrollment badge. Renders ONLY when the enrollment is
 * active (a verified-style "✓ Enrolled" mark). Expired, revoked, or unknown
 * states render nothing - the student simply has no badge, and administrative
 * details (expiry dates, revocations) are never shown to them.
 */
export function EnrolledBadge({ status, size = "md" }: { status: EffectiveEnrollment; size?: "sm" | "md" }) {
  if (status !== "enrolled") return null;

  const dims = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      title="Active enrollment"
      className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600"
    >
      <svg viewBox="0 0 20 20" fill="none" className={dims} aria-hidden>
        <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.15" />
        <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Enrolled
    </span>
  );
}
