"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp, advanceNativeInput } from "@/lib/native";
import { passwordPolicyError } from "@/lib/signupValidation";
import { NativeAuthShell } from "@/components/native/NativeAuthShell";

type Status = "idle" | "saving" | "done" | "invalid" | "error";

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as { message?: string })?.message ?? String(err);
  return /fetch|Network|network|ERR_INTERNET|Failed/i.test(msg);
}

/**
 * Android (Capacitor) password-reset completion screen.
 *
 * The user reaches this page after tapping the reset link in their email:
 *  1. On Android, when App Link verification has completed, the link opens
 *     the app directly; NativeDeepLink exchanges the recovery code for a
 *     session and routes here (/reset-password).
 *  2. On the web deployment this page is the AuthCard-based desktop UI.
 *  3. If App Link verification hasn't completed, the link opens in the
 *     system browser and the existing web recovery flow runs instead.
 *
 * Session verification: on mount this page calls getUser() and only shows
 * the form when a valid recovery session exists (valid link / code already
 * exchanged).  Missing, expired, invalid, or already-used links land on the
 * "invalid or expired" state instead of a fake editable form.
 *
 * Reuses the same password policy (MIN_PASSWORD_LENGTH, letter + number)
 * as the web signup form via lib/signupValidation.ts.  Security: updateUser
 * requires a valid session (the recovery code exchange), so the page is
 * safe even if bundled inside the APK.
 */
export function NativeResetPassword() {
  const searchParams = useSearchParams();
  const linkInvalid = searchParams.get("invalid") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [verifying, setVerifying] = useState(true);
  const [retry, setRetry] = useState(0);

  // Verify a valid recovery session exists before allowing the form.
  // The deep-link handler (NativeDeepLink) exchanges the recovery code and
  // navigates here; getUser() must return a valid user for updateUser to
  // work.  If the user navigates to this page without a valid session
  // (e.g., expired link, manual URL entry), show the invalid state.
  // On network failure (offline) show an error with retry instead of
  // misleading "invalid link" messaging.
  useEffect(() => {
    if (!isNativeApp()) return;
    let disposed = false;
    (async () => {
      if (linkInvalid) {
        if (!disposed) { setStatus("invalid"); setVerifying(false); }
        return;
      }
      const supabase = createClient();
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (disposed) return;
        if (error || !user) {
          setStatus(isNetworkError(error) ? "error" : "invalid");
        } else {
          setStatus("idle");
        }
      } catch (err) {
        if (!disposed) setStatus(isNetworkError(err) ? "error" : "invalid");
      }
      if (!disposed) setVerifying(false);
    })();
    return () => { disposed = true; };
  }, [linkInvalid, retry]);

  function validate(): boolean {
    const next: typeof errors = {};
    const pwError = passwordPolicyError(password);
    if (pwError) {
      next.password = pwError;
    }
    if (confirm !== password) {
      next.confirm = "Passwords don't match.";
    } else if (!confirm) {
      next.confirm = "Confirm your new password.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "saving") return;
    if (!validate()) return;

    setStatus("saving");
    setErrors({});

    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseConfigured) {
      setErrors({ form: "Password reset isn't configured yet on this build." });
      setStatus("idle");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrors({
          form:
            "This reset link is invalid or has expired. Request a new one from the forgot-password page.",
        });
        setStatus("invalid");
        return;
      }

      setStatus("done");
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
      setStatus("idle");
    }
  }

  return (
    <NativeAuthShell>
      {verifying ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-live="polite">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" aria-hidden />
          <p className="text-sm text-[var(--muted)]">Checking your reset link...</p>
        </div>
      ) : status === "done" ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-[var(--accent)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-[var(--text)]">Password updated</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Your password has been changed successfully. You can now log in with your new password.
          </p>
          <Link
            replace
            href="/login"
            className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-navy text-sm font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 active:scale-[0.98] touch-manipulation"
          >
            Log In
          </Link>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warn-soft text-warn">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-[var(--text)]">Couldn&apos;t verify</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            We couldn&apos;t check your reset link. Make sure you&apos;re connected to the internet and try again.
          </p>
          <button
            type="button"
            onClick={() => { setRetry((r) => r + 1); setVerifying(true); setStatus("idle"); }}
            className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-navy text-sm font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 active:scale-[0.98] touch-manipulation"
          >
            Retry
          </button>
          <Link
            replace
            href="/login"
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-base bg-surface text-sm font-bold uppercase tracking-widest text-navy transition hover:border-accent-soft active:scale-[0.98] touch-manipulation"
          >
            Back to Log In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col">
          <p className="text-center text-[15px] font-semibold text-[var(--text)]">Create a new password</p>
          <p className="mt-1.5 text-center text-sm leading-6 text-[var(--muted)]">
            Choose a strong password for your Hierarchy Class account.
          </p>

          <div className="mt-4 rounded-xl border border-base bg-surface px-4 py-3 text-[13px] leading-6 text-[var(--muted)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">Password requirements</p>
            <ul className="mt-1 list-disc pl-4">
              <li>At least 8 characters</li>
              <li>At least one letter and one number</li>
            </ul>
          </div>

          {errors.form && (
            <div className="mt-4 rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
              {errors.form}
              <Link
                href="/forgot-password"
                className="mt-1 block font-semibold text-warn underline"
              >
                Request a new link
              </Link>
            </div>
          )}

          {status === "invalid" && !errors.form && (
            <div className="mt-4 rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
              This reset link is invalid or has expired.
              <Link
                href="/forgot-password"
                className="mt-1 block font-semibold text-warn underline"
              >
                Request a new link
              </Link>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-1.5">
            <label htmlFor="native-reset-pass" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              New password
            </label>
            <div className="relative">
              <input
                id="native-reset-pass"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="At least 8 characters"
                disabled={status === "saving"}
                autoComplete="new-password"
                enterKeyHint="next"
                onKeyDown={(e) => advanceNativeInput(e, "native-reset-confirm")}
                className={`h-12 w-full rounded-xl border bg-surface px-4 pr-12 text-[15px] text-[var(--text)] outline-none transition-all placeholder:text-[var(--faint)] disabled:bg-tile disabled:text-faint
                  ${errors.password ? "border-warn-soft" : "border-base focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[rgba(158,167,179,0.18)]"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--faint)] transition hover:text-[var(--text)]"
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.8 21.8 0 015.06-6.06M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.75 21.75 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="text-xs text-warn">{errors.password}</p>}
            {!errors.password && (
              <p className="text-[11px] text-[var(--faint)]">At least 8 characters, with a letter and a number.</p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="native-reset-confirm" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Confirm password
            </label>
            <input
              id="native-reset-confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
              }}
              placeholder="Repeat your new password"
              disabled={status === "saving"}
              autoComplete="new-password"
              enterKeyHint="go"
              className={`h-12 w-full rounded-xl border bg-surface px-4 text-[15px] text-[var(--text)] outline-none transition-all placeholder:text-[var(--faint)] disabled:bg-tile disabled:text-faint
                ${errors.confirm ? "border-warn-soft" : "border-base focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[rgba(158,167,179,0.18)]"}`}
            />
            {errors.confirm && <p className="text-xs text-warn">{errors.confirm}</p>}
          </div>

          <button
            type="submit"
            disabled={status === "saving"}
            className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-navy text-[15px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 touch-manipulation"
          >
            {status === "saving" && (
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {status === "saving" ? "Updating password..." : "Update Password"}
          </button>

          <Link
            replace
            href="/login"
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-base bg-surface text-sm font-bold uppercase tracking-widest text-navy transition hover:border-accent-soft active:scale-[0.98] touch-manipulation"
          >
            Back to Log In
          </Link>
        </form>
      )}
    </NativeAuthShell>
  );
}