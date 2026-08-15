/**
 * Default avatar for users without a photo. An inline SVG so it can adapt to
 * the active theme through CSS variables: in Midnight it is the neutral gray
 * silhouette on the dark tile; in Rose the silhouette turns Cavern Pink, so
 * girls without a profile picture still get a feminine default.
 */
export function DefaultAvatar({
  className = "",
  style,
  label = "Avatar",
}: {
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={label}
      className={`shrink-0 overflow-hidden rounded-full ${className}`}
      style={style}
    >
      {/* Tile background */}
      <rect width="48" height="48" fill="var(--tile)" />
      {/* Shoulders */}
      <path d="M9 47c0-8.6 6.7-14.2 15-14.2S39 38.4 39 47H9z" fill="var(--asphalt)" />
      {/* Head */}
      <circle cx="24" cy="18.5" r="9.5" fill="var(--asphalt)" />
    </svg>
  );
}
