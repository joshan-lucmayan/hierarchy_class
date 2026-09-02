export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="dark flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mx-auto max-w-md rounded-[10px] border border-base bg-surface p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-token">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <path d="M1 1l22 22" />
          </svg>
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-navy">You&apos;re offline</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Hierarchy Class needs a connection to load your school data. Your grades, messages, and
          ranks will sync automatically when you&apos;re back online.
        </p>
        <p className="mt-2 text-xs text-faint">Check your connection and try again.</p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Try again
        </a>
      </div>
      <p className="mt-6 text-[11px] text-faint">Hierarchy Class · offline · your data is safe and will sync later</p>
    </main>
  );
}
