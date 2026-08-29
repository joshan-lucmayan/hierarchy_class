"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { siteUrlBase } from "@/lib/siteUrl";
import { isValidEmail } from "@/lib/signupValidation";
import { NativeAuthShell } from "@/components/native/NativeAuthShell";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Android (Capacitor) forgot-password screen.
 *
 * A dedicated mobile-first presentation for the standalone Android app,
 * separate from the desktop web forgot-password UI (app/forgot-password
 * renders the web AuthCard version on the web deployment). Reuses the exact
 * same Supabase auth call (resetPasswordForEmail) and security model - the
 * only thing that differs is the presentation.
 *
 * Security: on success we always show the generic "check your email" state,
 * whether or not the account exists - no email enumeration. On failure a
 * friendly generic message is shown; internal Supabase errors are never
 * surfaced. Retry keeps the entered email.
 *
 * Rendered only by the Android export build (page gates on CAPACITOR_EXPORT);
 * the web deployment never mounts this component.
 */
export function NativeForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!email.trim()) return "Enter your email address.";
    if (!isValidEmail(email)) return "Enter a valid email address.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return; // prevent duplicate submissions
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStatus("sending");

    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseConfigured) {
      setError("Password reset isn't configured yet on this build.");
      setStatus("error");
      return;
    }

    try {
      const supabase = createClient();
      const siteUrl = siteUrlBase();
      if (!siteUrl) {
        setError("Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      // Same redirect target as the web forgot-password flow. In the Android
      // export this resolves to the deployed backend origin (see
      // lib/siteUrl.ts), which hosts the /auth/callback exchange route.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${siteUrl}/auth/callback?type=recovery`,
      });
      if (resetError) {
        setError("Something went wrong. Please check your connection and try again.");
        setStatus("error");
        return;
      }
      // Deliberately generic: don't reveal whether the account exists.
      setStatus("sent");
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <NativeAuthShell>
      {status === "sent" ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-[var(--gold)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 7l-10 6L2 7" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-[var(--text)]">Check your email</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            If an account is associated with <span className="font-semibold text-[var(--text)]">{email.trim()}</span>,
            you&apos;ll receive instructions to reset your password.
          </p>
          <Link
            replace
            href="/login"
            className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-base bg-surface text-sm font-bold uppercase tracking-widest text-navy transition hover:border-gold-soft active:scale-[0.98] touch-manipulation"
          >
            Back to Log In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col">
          <p className="text-center text-[15px] font-semibold text-[var(--text)]">Forgot your password?</p>
          <p className="mt-1.5 text-center text-sm leading-6 text-[var(--muted)]">
            No worries. Enter the email address associated with your account and we&apos;ll send you a
            secure password reset link.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-1.5">
            <label htmlFor="native-forgot-email" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Email
            </label>
            <input
              id="native-forgot-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="you@example.com"
              disabled={status === "sending"}
              autoComplete="email"
              inputMode="email"
              enterKeyHint="go"
              className="h-12 w-full rounded-xl border border-base bg-surface px-4 text-[15px] text-[var(--text)] outline-none transition-all placeholder:text-[var(--faint)] focus:border-[var(--gold)] focus:ring-[3px] focus:ring-[rgba(158,167,179,0.18)] disabled:bg-tile disabled:text-faint"
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-navy text-[15px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 touch-manipulation"
          >
            {status === "sending" && (
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {status === "sending" ? "Sending reset link..." : "Send Reset Link"}
          </button>

          <Link
            replace
            href="/login"
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-base bg-surface text-sm font-bold uppercase tracking-widest text-navy transition hover:border-gold-soft active:scale-[0.98] touch-manipulation"
          >
            Back to Log In
          </Link>
        </form>
      )}
    </NativeAuthShell>
  );
}
