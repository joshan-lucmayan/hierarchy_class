/**
 * The app's card primitive: 1px hairline border, surface background, 10px
 * radius, no shadow. Historically it was a passthrough div and every caller
 * passed the full class string, so the defaults stay compatible:
 *
 * - Callers that pass their own border color or background get theirs (the
 *   default tokens are dropped instead of fighting in the stylesheet).
 * - Callers that pass nothing get the standard card anatomy.
 * - `tone` is a convenience for the two accent cards (accent featured /
 *   warn attention) without hand-writing border classes.
 */
export function CornerFrame({
  children,
  className = "",
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "accent" | "warn";
}) {
  const hasBorderOverride = /\bborder-(?!base\b)[\w[\]-]+/.test(className);
  const hasBgOverride = /\bbg-(?!surface\b)[\w[\]-]+/.test(className);
  const cls = className.replace(/\bborder-base\b/g, "").replace(/\bbg-surface\b/g, "").trim();
  const border =
    tone === "accent" ? "border-accent-soft" : tone === "warn" ? "border-warn-soft" : hasBorderOverride ? "" : "border-base";
  const bg = hasBgOverride ? "" : "bg-surface";
  return <div className={`rounded-[10px] border ${border} ${bg} ${cls}`}>{children}</div>;
}
