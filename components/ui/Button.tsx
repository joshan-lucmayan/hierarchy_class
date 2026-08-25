"use client";

/**
 * Shared button - the Hierarchy Class action language. Variants cover every
 * action without hardcoding emerald / blue / red: primary (navy), gold
 * (featured / creation), outline (quiet secondary), danger (destructive,
 * warn token), ghost (minimal, for grouped controls).
 *
 * `shape` lets the same component serve both pill actions (default) and the
 * square segmented command group on the admin header. Hover/pressed/focus
 * states are built in and theme-aware (token hover utilities from
 * globals.css, subtle 0.98 press, gold focus ring).
 */
export interface ButtonProps {
  /** Optional - icon-only square buttons render fine with no label. */
  children?: React.ReactNode;
  /** Accepts the mouse event so nested row actions can stopPropagation. */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  variant?: "primary" | "gold" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  shape?: "pill" | "square";
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  className?: string;
}

const VARIANTS = {
  primary: "bg-navy text-white hover-bg-gold-token hover-text-on-accent",
  gold: "bg-gold-token text-on-accent hover:opacity-90",
  outline: "border border-base bg-surface text-navy hover-border-gold-soft",
  danger: "border border-warn-soft bg-surface text-warn hover-bg-warn-soft",
  ghost: "border border-transparent text-muted hover-bg-tile hover:text-navy",
} as const;

const SIZES = {
  sm: "px-3.5 py-1.5 text-xs gap-1.5 max-[767px]:min-h-[44px] max-[767px]:px-4 max-[767px]:py-2.5",
  md: "px-5 py-2.5 text-sm gap-2 max-[767px]:min-h-[44px]",
  lg: "px-6 py-3 text-sm gap-2 max-[767px]:min-h-[44px]",
} as const;

const SHAPES = {
  pill: "rounded-full",
  square: "rounded-[8px]",
} as const;

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  shape = "pill",
  icon,
  disabled,
  loading,
  title,
  className = "",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={(e) => onClick?.(e)}
      disabled={disabled || loading}
      title={title}
      className={`inline-flex items-center justify-center font-semibold touch-manipulation transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50 ${SHAPES[shape]} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? (
        <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
