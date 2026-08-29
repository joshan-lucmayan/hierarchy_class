"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { homePathForRole } from "@/lib/authz";
import { isNativeApp, cacheNativeRole } from "@/lib/native";
import { resolvePasswordLogin } from "@/lib/passwordLogin";
import { resendSignupConfirmation } from "@/lib/bridgeClient";

function FieldLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-navy">
      {icon}
      {children}
    </label>
  );
}

export function LoginForm() {
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
        // TEMP: no Supabase project wired up yet - simulate the network delay
        // so the full click-through (including the loading state) still works.
        await new Promise((resolve) => setTimeout(resolve, 700));
        window.location.href = "/student/home";
        return;
      }

      const supabase = createClient();
      const result = await resolvePasswordLogin(supabase, email, password);

      if (!result.ok) {
        setErrors({ form: result.error });
        if (result.resendEmail) setResendEmail(result.resendEmail);
        return;
      }

      const role = result.role;

      // Credentials + profile resolved - show the branded loading state while
      // the session redirects to the user's home (never a frozen form).
      if (isNativeApp()) {
        // Remember the role for the Android offline cold-start path.
        cacheNativeRole(role);
        // location.replace: the login page leaves the history stack, so the
        // hardware back button from the role home never re-opens the entry/
        // login flow (and the native root gate never has to bounce back).
        setPhase("authenticating");
        window.location.replace(homePathForRole(role));
        return;
      }
      setPhase("authenticating");
      window.location.href = homePathForRole(role);
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
      <div className="animate-pop-in flex w-full flex-col items-center gap-4 py-8 text-center">
        <span
          className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[var(--gold)]/40 bg-[var(--surface-strong)] text-[var(--gold)]"
          style={{ animation: "haloPulse 2.2s ease-in-out infinite" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 17l3-4 4 4 5-6 4 4 4-3" />
            <path d="M12 2c1 2 3 4 5 4 0 2-2 4-4 4" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-bold text-navy">Signing you in</h2>
          <p className="mt-1 text-sm text-muted">Loading your account and rank...</p>
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--gold)]"
            style={{ animation: "fillbar 1.4s ease-in-out infinite" }}
          />
        </div>
        <p className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">
          One moment - setting up your workspace
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-5">
      {justConfirmed && (
        <div className="rounded-lg border border-gold-soft bg-gold-soft px-3.5 py-2.5 text-sm text-gold-token">
          Email confirmed! You can now log in.
        </div>
      )}
      {confirmationFailed && (
        <div className="animate-shake rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          This confirmation link is invalid or has expired. Request a new one below.
        </div>
      )}
      {unverified && (
        <div className="animate-shake rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          You need to confirm your email before you can use the app. Enter your email below to resend the link.
        </div>
      )}
      {errors.form && (
        <div className="animate-shake rounded-lg border border-warn-soft bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          {errors.form}
        </div>
      )}
      {resendStatus && (
        <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${resendStatus.startsWith("A new") ? "border-gold-soft bg-gold-soft text-gold-token" : "border-warn-soft bg-warn-soft text-warn"}`}>
          {resendStatus}
        </div>
      )}

      <div className="group flex flex-col gap-1.5">
        <FieldLabel
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="transition-all duration-300 group-focus-within:scale-110 group-focus-within:text-[var(--gold)]"
            >
              <path d="M4 4h16v16H4z" opacity="0" />
              <path d="M22 6l-10 7L2 6" />
              <path d="M2 6h20v20H2z" />
            </svg>
          }
        >
          Email
        </FieldLabel>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isLoading}
          autoComplete="email"
          className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all disabled:bg-tile disabled:text-faint
            ${errors.email ? "border-warn-soft" : "border-base focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_rgba(158,167,179,0.18)]"}`}
        />
        {errors.email && <p className="animate-shake text-xs text-warn">{errors.email}</p>}
      </div>

      <div className="group flex flex-col gap-1.5">
        <FieldLabel
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="transition-all duration-300 group-focus-within:scale-110 group-focus-within:text-[var(--gold)]"
            >
              <rect x="5" y="11" width="14" height="10" rx="1.5" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
          }
        >
          Password
        </FieldLabel>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isLoading}
            autoComplete="current-password"
            className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none transition-all disabled:bg-tile disabled:text-faint
              ${errors.password ? "border-warn-soft" : "border-base focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_rgba(158,167,179,0.18)]"}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-navy"
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.8 21.8 0 015.06-6.06M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.75 21.75 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && <p className="animate-shake text-xs text-warn">{errors.password}</p>}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="group relative mt-1 flex items-center justify-center overflow-hidden rounded-lg bg-navy py-3 text-sm font-bold uppercase tracking-widest text-white transition-opacity disabled:opacity-90"
      >
        {isLoading && (
          <span className="absolute inset-y-0 left-0 w-full origin-left animate-fillbar bg-gold/90" />
        )}
        <span className="relative flex items-center gap-2">
          {isLoading ? "Loading" : "Enter"}
          {!isLoading && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
      </button>

      <a href="/forgot-password" className="text-center text-sm text-muted hover:underline">
        Forgot password?
      </a>

      {resendEmail && (
        <form onSubmit={handleResend} className="rounded-lg border border-base bg-[var(--surface-strong)] p-3.5">
          <p className="text-xs font-semibold text-navy">Didn&apos;t get the confirmation email?</p>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={resending}
              className="min-w-0 flex-1 rounded-md border border-base px-3 py-2 text-sm outline-none focus:border-[var(--gold)] disabled:bg-tile"
            />
            <button
              type="submit"
              disabled={resending}
              className="shrink-0 rounded-md bg-navy px-3 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-60"
            >
              {resending ? "Sending" : "Resend"}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-xs text-muted">
        Need an account? <a href="/signup" className="font-semibold text-navy hover:underline">Sign up</a> or contact your school admin.
      </p>
    </form>
  );
}
