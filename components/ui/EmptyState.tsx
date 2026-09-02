/**
 * Composed empty state shared by the admin and teacher command centers:
 * small icon tile + mono heading + short explanation. Compact by design,
 * never a big illustration.
 */
export function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="pt-2 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-token">
        {icon}
      </span>
      <p className="mt-3 font-mono-ui text-[11px] font-semibold uppercase tracking-[0.2em] text-navy">{title}</p>
      <p className="mx-auto mt-1 max-w-[280px] text-xs leading-5 text-muted">{desc}</p>
    </div>
  );
}
