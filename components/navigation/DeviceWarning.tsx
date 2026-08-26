"use client";

import { CrownMark } from "@/components/ui/CrownMark";
import { LogoutButton } from "@/components/auth/LogoutButton";

/**
 * Responsive device-access warning shown to Teacher and Admin users on
 * phone-sized viewports (< 768px). Replaces the entire application UI
 * with a branded screen that communicates the supported device policy.
 *
 * The user remains authenticated; this is purely a UI layer. Resizing
 * to a supported width (>= 768px) immediately reveals the normal app.
 */

function DeviceIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-faint"
      aria-hidden
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function DeviceWarning({
  role,
  brandHref,
}: {
  role: "teacher" | "admin";
  brandHref: string;
}) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      style={{ minHeight: "100dvh" }}
    >
      <CrownMark height={36} />

      <div className="mt-6">
        <DeviceIcon />
      </div>

      <h1 className="mt-5 font-display text-xl font-bold text-navy sm:text-2xl">
        {role === "teacher"
          ? "Teaching works better on a larger screen"
          : "Admin tools require a larger workspace"}
      </h1>

      <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
        {role === "teacher"
          ? "Hierarchy Class for Teachers is designed for tablet, laptop, or desktop. Please continue on a larger screen to access the full Teacher workspace."
          : "Admin access requires a larger workspace. Please use a tablet, laptop, or desktop to manage your school\u2019s Hierarchy Class portal."}
      </p>

      <p className="mt-2 text-xs text-faint">
        Supported devices: tablets, laptops, and desktop browsers.
      </p>

      <div className="mt-8">
        <LogoutButton />
      </div>

      <a
        href={brandHref}
        className="mt-4 text-xs font-semibold text-faint transition hover:text-navy"
      >
        Try again on a larger screen
      </a>
    </div>
  );
}
