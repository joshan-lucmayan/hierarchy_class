/**
 * Florin coin - a designed mark, not a letter. Flat Great Falls disc with a
 * hairline inner ring and the brand crown struck in the center, all routed
 * through tokens so it works in both themes.
 */
export function CoinIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <circle cx="12" cy="12" r="11" fill="var(--gold)" />
      <circle
        cx="12"
        cy="12"
        r="8.6"
        stroke="var(--on-accent)"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      {/* Brand crown: center peak tallest, side peaks angled out. */}
      <path
        d="M7.2 15.2 L8.6 10.4 L10.6 13.2 L12 9.4 L13.4 13.2 L15.4 10.4 L16.8 15.2 Z"
        fill="var(--on-accent)"
      />
      <path
        d="M12 15.9 L12 17.6"
        stroke="var(--on-accent)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
