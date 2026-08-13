"use client";

/**
 * Shared avatar for the whole system. Renders the profile's real photo when
 * one exists; otherwise the school's default avatar image
 * (/avatars/default-avatar.webp) so every teacher/admin/student without a
 * photo shows a clean, consistent placeholder.
 */
export function UserAvatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}) {
  const sizes: Record<string, string> = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-base",
    "2xl": "h-24 w-24 text-2xl",
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || "/avatars/default-avatar.webp"}
      alt={name ?? "Avatar"}
      className={`${sizes[size]} shrink-0 rounded-full border border-line object-cover ${className}`}
    />
  );
}
