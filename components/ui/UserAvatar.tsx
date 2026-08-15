"use client";

import { useShop } from "@/lib/shopStore";
import { DefaultAvatar } from "@/components/ui/DefaultAvatar";

/**
 * Shared avatar for the whole system. Renders the profile's real photo when
 * one exists; otherwise the theme-adaptive DefaultAvatar (gray silhouette in
 * Midnight, Cavern Pink silhouette in Rose) so every teacher/admin/student
 * without a photo shows a clean, consistent placeholder that fits the theme.
 *
 * When `profileId` is provided, the avatar shows the owner's equipped shop
 * avatar border (a colored ring) - the Discord-style decoration follows the
 * user everywhere their avatar appears.
 */
export function UserAvatar({
  name,
  src,
  size = "md",
  className = "",
  profileId,
  decorColor,
}: {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  profileId?: string | null;
  /** Force a ring color (used by shop previews); falls back to the equipped border. */
  decorColor?: string | null;
}) {
  const { decorColorOf } = useShop();
  const sizes: Record<string, string> = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-base",
    "2xl": "h-24 w-24 text-2xl",
  };

  const decor = decorColor ?? decorColorOf(profileId);
  const hasPhoto = Boolean(src) && src !== "/avatars/default-avatar.webp";
  const decorStyle = decor
    ? { boxShadow: `0 0 0 2px var(--bg), 0 0 0 4px ${decor}` }
    : undefined;

  if (!hasPhoto) {
    return (
      <DefaultAvatar
        label={name ?? "Avatar"}
        className={`${sizes[size]} border border-line ${className}`}
        style={decorStyle}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? ""}
      alt={name ?? "Avatar"}
      className={`${sizes[size]} shrink-0 rounded-full border border-line object-cover ${className}`}
      style={decorStyle}
    />
  );
}
