"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteUrlBase } from "@/lib/siteUrl";

/**
 * Desktop/tablet forgot-password form (rendered inside AuthCard on the web
 * deployment). Moved out of app/forgot-password/page.tsx so the page can
 * switch between this web UI and the Android-specific NativeForgotPassword
 * based on the CAPACITOR_EXPORT build flag. The UI and behavior are
 * unchanged from the original implementation.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setStatus("sending");
    setError("");

    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseConfigured) {
      // UI-only fallback (no Supabase configured): simulate success so the
      // flow stays testable, without claiming an email was sent.
      setStatus("sent");
      return;
    }

    const supabase = createClient();
    const siteUrl = siteUrlBase();
    if (!siteUrl) {
      setError("Password recovery isn't configured yet. Please contact support.");
      setStatus("error");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/auth/callback?type=recovery`,
    });

    if (resetError) {
      // Deliberately generic: don't reveal whether the account exists.
      setStatus("sent");
      return;
    }
    setStatus("sent");
  }

  return (
    <>
      {status === "sent" ? (
        <div className="animate-pop-in flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path className="draw-check" d="M22 7l-10 6L2 7" />
            </svg>
          </span>
          <h1 className="text-lg font-bold text-navy">Check your email</h1>
          <p className="text-sm leading-6 text-muted">
            If an account exists for that address, we&apos;ve sent a password reset link. Follow the link in the
            email to choose a new password.
          </p>
          <a
            href="/login"
            className="mt-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover-bg-gold-token hover-text-on-accent"
          >
            Back to login
          </a>
        </div>
      ) : (
        <>
          <div className="w-full text-center">
            <h1 className="text-xl font-bold uppercase tracking-[0.15em] text-navy">Forgot password</h1>
            <p className="mt-2 text-sm text-muted">
              Enter the email you signed up with and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-navy">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={status === "sending"}
                className="rounded-lg border border-base px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_rgba(158,167,179,0.18)] disabled:bg-surface-50"
              />
            </div>
            {error && <p className="animate-shake text-xs text-warn">{error}</p>}
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-navy py-3 text-sm font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {status === "sending" ? "Sending..." : "Send reset link"}
            </button>
            <a href="/login" className="text-center text-sm text-muted hover:underline">
              Back to login
            </a>
          </form>
        </>
      )}
    </>
  );
}
