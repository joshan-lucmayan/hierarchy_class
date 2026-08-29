import { CrownMark } from "@/components/ui/CrownMark";

/**
 * Shared shell for the standalone Android auth screens (login/signup).
 *
 * The Android app ships its own mobile-first authentication presentation that
 * is completely separate from the desktop web AuthCard. This shell provides
 * the common, minimal, premium Android-facing frame: plain token background,
 * centered single column, brand lockup (crown + wordmark + canonical
 * tagline), safe-area padding, and a vertically scrollable area so the
 * keyboard never hides fields or actions.
 *
 * The tagline is the project's canonical wording from README.md / the web
 * layout metadata: "Make school feel like a game worth playing." No other
 * project's copy is used.
 *
 * Rendered ONLY in the Capacitor Android export build (app/login and
 * app/signup gate on CAPACITOR_EXPORT), never on the web deployment.
 */
export function NativeAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dark flex h-dvh flex-col bg-[var(--bg)] text-[var(--text)]"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full flex-col items-center justify-center py-6">
          <div className="mx-auto flex w-full max-w-[400px] flex-col items-center text-center">
            <div className="flex items-center justify-center text-[var(--gold)]">
              <CrownMark height={48} />
            </div>
            <h1 className="mt-4 font-display text-[19px] font-semibold uppercase tracking-[0.12em] text-[var(--text)]">
              Hierarchy Class
            </h1>
            <p className="mt-1.5 text-[13px] font-semibold text-[var(--muted)]">
              Make school feel like a game worth playing.
            </p>
          </div>

          <div className="mt-8 w-full max-w-[400px]">{children}</div>
        </div>
      </div>
    </div>
  );
}