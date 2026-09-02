import { CrownMark } from "@/components/ui/CrownMark";

/**
 * Android boot screen (standalone Capacitor app only).
 *
 * Rendered as the static HTML of "/" in the Android export build, so the
 * first paint on a cold start is already the minimal app boot - no marketing
 * landing, no desktop content, no hydration mismatch. NativeRootGate drives
 * it as a transient boot state while the persisted session is being resolved:
 *
 *   - A valid session is routed to the role home.
 *   - No valid session is routed directly to the Login screen, which owns the
 *     "Welcome back" greeting and the Create an Account path. There is no
 *     separate entry chooser ("Log In" / "Create an Account") anymore - the
 *     redundant choice was removed so Android enters directly into Login.
 *
 * The tagline is the project's canonical wording (README.md headline, web
 * landing hero and layout metadata all use it): "Make school feel like a
 * game worth playing." The sub-line is verbatim from the app metadata
 * description. No other project's copy is used.
 *
 * Deliberately minimal and mobile-first: plain token background, centered
 * column, generous whitespace, safe-area padding, works 320px → 430px+ with
 * no horizontal overflow. Light/dark stay coherent through the shared tokens.
 * Web "/" never renders this (app/page.tsx keeps the server-redirect +
 * Landing).
 */
export function NativeEntry() {
  return (
    <div
      className="dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--bg)] px-6 text-[var(--text)]"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1.5rem, env(safe-area-inset-left))",
        paddingRight: "max(1.5rem, env(safe-area-inset-right))",
      }}
    >
      <main className="flex w-full max-w-[340px] flex-col items-center text-center">
        {/* Brand: the existing Hierarchy Class crown - no new artwork. */}
        <div className="flex items-center justify-center text-[var(--accent)]">
          <CrownMark height={56} />
        </div>

        <h1 className="mt-6 font-display text-[22px] font-semibold uppercase tracking-[0.12em] text-[var(--text)]">
          Hierarchy Class
        </h1>
        <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
          Make school feel like a game worth playing.
        </p>
        <p className="mt-1.5 text-xs text-[var(--faint)]">
          Gamified academic tracking for students, teachers, and campuses.
        </p>

        {/* Boot state: the persisted session is being resolved. */}
        <div
          className="mt-12 flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"
            aria-hidden
          />
          <span className="sr-only">Checking your session</span>
        </div>
      </main>
    </div>
  );
}
