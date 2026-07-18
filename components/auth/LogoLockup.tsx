export function LogoLockup() {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="72" height="52" viewBox="0 0 72 52" fill="none">
        <rect x="0" y="30" width="18" height="22" rx="2" className="fill-navy" />
        <rect x="24" y="18" width="18" height="34" rx="2" className="fill-navy" />
        <rect x="48" y="6" width="18" height="46" rx="2" className="fill-navy" />
        <path d="M57 0l3 6 6 1-4.5 4.5 1 6L57 14.5 51 17.5l1-6L47.5 7l6-1z" className="fill-gold" />
      </svg>

      <div className="flex flex-col items-center gap-1.5">
        <h1 className="text-2xl font-bold uppercase tracking-[0.15em] text-navy">
          Hierarchy Class
        </h1>
        <div className="h-[2px] w-10 bg-gold" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
          Climb the ranks
        </p>
      </div>
    </div>
  );
}
