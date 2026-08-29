import Link from "next/link";
import { CrownMark } from "@/components/ui/CrownMark";

/**
 * Unauthenticated Android entry screen (standalone Capacitor app only).
 *
 * Rendered as the static HTML of "/" in the Android export build, so the
 * first paint on a cold start is already the minimal app entry — no marketing
 * landing, no desktop content, no hydration mismatch. The NativeRootGate
 * drives the two states:
 *
 *   boot    (showActions=false): logo lockup + a small spinner while the
 *           persisted session is being resolved.
 *   entry   (showActions=true):  same lockup + the two actions. Shown when
 *           there is no valid session (fresh install, signed out, expired).
 *
 * The tagline is the project's canonical wording (README.md headline, web
 * landing hero and layout metadata all use it): "Make school feel like a
 * game worth playing." The sub-line is verbatim from the app metadata
 * description. No other project's copy is used.
 *
 * The actions use Next <Link> CLIENT-side navigation on purpose: Capacitor's
 * local asset server runs in html5mode (WebViewLocalServer serves the root
 * index.html for every extensionless path), so a full-page
 * location.replace("/login") would re-load THIS entry screen at the URL
 * /login instead of the login page. Client-side routing fetches the RSC
 * payloads (extension-ful paths), which the asset server resolves correctly.
 *
 * Deliberately minimal and mobile-first: plain token background, centered
 * column, generous whitespace, large touch targets, safe-area padding, works
 * 320px → 430px+ with no horizontal overflow. Light/dark stay coherent
 * through the shared tokens. Web "/" never renders this (app/page.tsx keeps
 * the server-redirect + Landing).
 */
export function NativeEntry({ showActions = false }: { showActions?: boolean }) {
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
        {/* Brand: the existing Hierarchy Class crown — no new artwork. */}
        <div className="flex items-center justify-center text-[var(--gold)]">
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

        {showActions ? (
          <div className="mt-12 flex w-full flex-col gap-3">
            {/* Client-side navigation (see html5mode note above). The gate
                page stays in history; back from /login returns here, and the
                NativeRootGate's back-at-entry handler exits the app from this
                root, so no authenticated page can ever be reached by going
                back after logout. */}
            <Link
              href="/login"
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-navy text-sm font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] active:scale-[0.98] touch-manipulation"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-base bg-surface text-sm font-bold uppercase tracking-widest text-navy transition hover:border-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] active:scale-[0.98] touch-manipulation"
            >
              Create an Account
            </Link>
          </div>
        ) : (
          /* Boot state: the persisted session is being resolved. */
          <div
            className="mt-12 flex flex-col items-center gap-4"
            role="status"
            aria-live="polite"
          >
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent"
              aria-hidden
            />
            <span className="sr-only">Checking your session</span>
          </div>
        )}
      </main>
    </div>
  );
}
