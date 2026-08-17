"use client";

/**
 * Shared primary-action button (the design from the admin programs page):
 * a bordered tile with a small circular icon chip + label. Variants keep the
 * accent/gold, neutral, navy, and danger states consistent across every page.
 *
 * Usage:
 *   <ActionButton icon={<PlusIcon />} onClick={...}>Add program</ActionButton>
 */
export interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "gold" | "navy" | "neutral" | "danger";
  icon?: React.ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const VARIANTS = {
  gold: "border-gold-soft bg-gold-soft text-gold-token hover-bg-gold-token hover-text-on-accent",
  navy: "border-[var(--btn)]/50 bg-[var(--btn)]/10 text-navy hover:bg-[var(--btn)] hover:text-white",
  neutral: "border-base bg-surface text-muted hover:border-gold hover:text-navy",
  danger: "border-warn-soft bg-surface text-warn hover-bg-warn-soft",
} as const;

const TILES = {
  gold: "bg-gold text-on-accent",
  navy: "bg-[var(--btn)] text-white",
  neutral: "bg-tile text-muted",
  danger: "bg-warn-soft text-warn",
} as const;

export function ActionButton({
  children,
  onClick,
  type = "button",
  variant = "gold",
  icon,
  disabled,
  title,
  className = "",
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-2.5 rounded-[10px] border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {icon && (
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${TILES[variant]}`}>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

/** Small 12px plus icon used by most "add" actions. */
export function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Small 12px minus/close icon used to cancel an in-progress action. */
export function MinusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

/** Small 12px check icon used for save/confirm actions. */
export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Small 12px back arrow used for the back navigation buttons. */
export function BackIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}
