import type { EffectiveEnrollment } from "@/lib/useEnrollment";

/**
 * Student-facing enrollment indicator. Renders ONLY when the enrollment is
 * active - a clean green checkmark, no text. Expired, revoked, or unknown
 * states render nothing so the student simply has no badge.
 */
export function EnrolledBadge({ status, size = "md" }: { status: EffectiveEnrollment; size?: "sm" | "md" }) {
  if (status !== "enrolled") return null;

  const dims = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span title="Active enrollment" className="inline-flex shrink-0 items-center justify-center">
      <span className={`${dims} flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/15 text-emerald-600`}>
        <svg viewBox="0 0 20 20" fill="none" className="h-[70%] w-[70%]" aria-hidden>
          <path d="M5.5 10.5l3 3L14.5 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}
