"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { homePathForRole } from "@/lib/authz";
import { isNativeApp, cacheNativeRole, advanceNativeInput } from "@/lib/native";
import { resolvePasswordLogin } from "@/lib/passwordLogin";
import { resendSignupConfirmation } from "@/lib/bridgeClient";
import { NativeAuthShell } from "@/components/native/NativeAuthShell";

/**
 * Android (Capacitor) login screen.
 *
 * A dedicated mobile-first authentication presentation for the standalone
 * Android app - deliberately separate from the desktop web login UI
 * (components/auth/LoginForm.tsx). Reuses the exact same authentication
 * logic (lib/passwordLogin.ts), Supabase client, and session handling; only
 * the presentation differs.
 *
 * Layout: single column, centered brand lockup, comfortable 48dp touch
 * targets, safe-area aware, vertically scrollable so the keyboard never
 * covers the focused field or the actions.
 *
 * Rendered only by the Android export build (app/login gates on
 * CAPACITOR_EXPORT); the web deployment never mounts this component.
 */
export function NativeLogin() {
  const searchParams = useSearchParams();
  const justConfirmed = searchParams.get("confirmed") === "1";
  const confirmationFailed = searchParams.get("confirmed") === "0";
  const unverified = searchParams.get("unverified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<"form" | "authenticating">("form");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setErrors({});
    setIsLoading(true);

    try {
      const supabaseConfigured =
        !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseConfigured) {
        setErrors({ form: "Sign-in isn't configured yet on this build." });
        return;
      }

      const supabase = createClient();
      const result = await resolvePasswordLogin(supabase, email, password);

      if (!result.ok) {
        // Network failure (offline/backend unreachable) is surfaced with an
        // explicit offline message instead of a misleading auth error.
        setErrors({
          form: result.network
            ? "You're offline. Connect to the internet and try again."
            : result.error,
        });
        if (result.resendEmail) setResendEmail(result.resendEmail);
        return;
      }

      // Credentials + profile resolved. Remember the role for the Android
      // offline cold-start path, then replace the history entry so hardware
      // back from the role home never re-opens the login flow.
      cacheNativeRole(result.role);
      setPhase("authenticating");
      window.location.replace(homePathForRole(result.role));
    } catch {
      setErrors({ form: "Something went wrong. Try again." });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResending(true);
    setResendStatus(null);
    const target = resendEmail.trim();
    const result = await resendSignupConfirmation(target);
    setResending(false);
    setResendStatus(
      result.ok
        ? "A new confirmation link was sent. Check your inbox (and spam folder)."
        : result.error ?? "Couldn't resend. Try again in a moment."
    );
  }

  if (phase === "authenticating") {
    return (
      <NativeAuthShell>
        <div className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-live="polite">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" aria-hidden />
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">Signing you in</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Loading your account and rank...</p>
          </div>
        </div>
      </NativeAuthShell>
    );
  }

  return (
    <NativeAuthShell>
      <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col">
        <p className="text-center text-[15px] font-semibold text-[var(--text)]">Welcome back.</p>

        {justConfirmed && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft px-3.5 py-2.5 text-sm text-accent-token">
            Email confirmed! You can now log in.
          </div>
        )}
        {confirmationFailed && (
          <div className="mt-4 rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            This confirmation link is invalid or has expired. Request a new one below.
          </div>
        )}
        {unverified && (
          <div className="mt-4 rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            You need to confirm your email before you can use the app. Enter your email below to resend the link.
          </div>
        )}
        {errors.form && (
          <div className="mt-4 rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            {errors.form}
          </div>
        )}
        {resendStatus && (
          <div className={`mt-4 rounded-lg border px-3.5 py-2.5 text-sm ${resendStatus.startsWith("A new") ? "border-accent-soft bg-accent-soft text-accent-token" : "border-warn-soft bg-warn-soft text-warn"}`}>
            {resendStatus}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-1.5">
          <label htmlFor="native-email" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Email
          </label>
            <input
              id="native-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              onKeyDown={(e) => advanceNativeInput(e, "native-password")}
              className={`h-12 w-full rounded-xl border bg-surface px-4 text-[15px] text-[var(--text)] outline-none transition-all placeholder:text-[var(--faint)] disabled:bg-tile disabled:text-faint
                ${errors.email ? "border-warn-soft" : "border-base focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[rgba(158,167,179,0.18)]"}`}
            />
          {errors.email && <p className="mt-1 text-xs text-warn">{errors.email}</p>}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="native-password" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Password
          </label>
          <div className="relative">
            <input
              id="native-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isLoading}
              autoComplete="current-password"
              enterKeyHint="go"
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
          {errors.password && <p className="mt-1 text-xs text-warn">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-navy text-[15px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 touch-manipulation"
        >
          {isLoading ? "Logging in..." : "Log In"}
        </button>

        <Link
          href="/forgot-password"
          className="mt-4 flex min-h-[48px] items-center justify-center rounded-lg text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)] touch-manipulation"
        >
          Forgot password?
        </Link>

        {resendEmail && (
          <form onSubmit={handleResend} className="mt-2 rounded-xl border border-base bg-surface p-3.5">
            <p className="text-xs font-semibold text-[var(--text)]">Didn&apos;t get the confirmation email?</p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={resending}
                className="min-w-0 flex-1 rounded-lg border border-base bg-surface px-3.5 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:bg-tile"
              />
              <button
                type="submit"
                disabled={resending}
                className="shrink-0 rounded-lg bg-navy px-4 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-60"
              >
                {resending ? "Sending" : "Resend"}
              </button>
            </div>
          </form>
        )}

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
          <span className="text-xs text-[var(--faint)]">or</span>
          <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
        </div>

        <div className="flex flex-col gap-1 text-center">
          <p className="text-sm text-[var(--muted)]">Don&apos;t have an account?</p>
          <Link
            href="/signup"
            className="mt-1 flex min-h-[52px] w-full items-center justify-center rounded-xl border border-base bg-surface text-[15px] font-bold uppercase tracking-widest text-navy transition hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.98] touch-manipulation"
          >
            Create an Account
          </Link>
        </div>
      </form>
    </NativeAuthShell>
  );
}
