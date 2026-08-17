/**
 * Shared dashboard primitives for the customizable Home command centers
 * (Teacher Home and Admin Home).
 *
 * Both dashboards use the same validated model:
 *
 *   { "widgets": [ { "id": "...", "size": "medium", "tall": false, "order": 0 } ] }
 *
 * The teacher controls WHICH widgets exist, their ORDER, and their SIZE.
 * The layout engine (CSS Grid, 12 columns on desktop, 1 column on mobile)
 * decides POSITION - no x/y coordinates are ever saved. A tile's size maps
 * to a column span: small = 3, medium = 6, large = 9, full = 12. `tall`
 * maps to a 2-row span.
 */

/** Allowed tile sizes. Each maps to a 12-column CSS Grid span. */
export type WidgetSize = "small" | "medium" | "large" | "full";

export const WIDGET_SIZES: WidgetSize[] = ["small", "medium", "large", "full"];

/** Column span on the 12-column desktop grid. */
export const SIZE_COLUMNS: Record<WidgetSize, number> = {
  small: 3,
  medium: 6,
  large: 9,
  full: 12,
};

export const DEFAULT_WIDGET_SIZE: WidgetSize = "medium";

/** Column span classes for the 12-column grid (mobile stacks to one column). */
export const SPAN_CLASS: Record<WidgetSize, string> = {
  small: "md:col-span-3",
  medium: "md:col-span-6",
  large: "md:col-span-9",
  full: "md:col-span-12",
};

/** A widget in a dashboard registry: identity + which sizes it supports. */
export interface DashboardWidgetDef {
  id: string;
  label: string;
  description: string;
  /** Sizes the widget supports (defaults to all four). */
  sizes?: WidgetSize[];
  /** Default size when a fresh instance is added/placed. */
  defaultSize?: WidgetSize;
}

/**
 * A developer-created dashboard preset: a starting arrangement the user can
 * load into the draft and then modify freely. Presets are presentation-only
 * and never auto-apply - the user explicitly picks one, and it only becomes
 * their layout after Save. `order` follows array position.
 */
export interface DashboardPreset {
  id: string;
  label: string;
  description: string;
  widgets: ReadonlyArray<{ id: string; size: WidgetSize; tall: boolean }>;
}
