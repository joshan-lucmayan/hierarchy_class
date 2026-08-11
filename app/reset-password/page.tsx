"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoLockup } from "@/components/auth/LogoLockup";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "invalid">("idle");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirm !== password) {
      next.confirm = "Passwords don't match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      // Common causes: expired recovery link or session no longer valid.
      setErrors({ form: "This reset link is invalid or has expired. Request a new one from the forgot-password page." });
      setStatus("invalid");
      return;
    }

    setStatus("done");
    setTimeout(() => {
      window.location.href = "/login";
    }, 2500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm rounded-2xl border-2 border-gold bg-surface p-10 shadow-xl sm:p-12">
        <div className="flex flex-col items-center gap-8">
          <LogoLockup />
          <div className="w-full border-t border-gold opacity-60" />

          {status === "done" ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-3xl">✅</p>
              <h1 className="text-lg font-bold text-navy">Password updated</h1>
              <p className="text-sm text-muted">You can now sign in with your new password.</p>
              <a href="/login" className="mt-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy">
                Go to login
              </a>
            </div>
          ) : (
            <>
              <div className="w-full text-center">
                <h1 className="text-xl font-bold uppercase tracking-[0.15em] text-navy">Choose a new password</h1>
                <p className="mt-2 text-sm text-muted">Enter your new password below.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-navy">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      disabled={status === "saving"}
                      className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors disabled:bg-surface-50
                        ${errors.password ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-navy">Confirm password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your new password"
                    disabled={status === "saving"}
                    className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors disabled:bg-surface-50
                      ${errors.confirm ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
                  />
                  {errors.confirm && <p className="text-xs text-red-500">{errors.confirm}</p>}
                </div>

                {errors.form && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                    {errors.form}
                    <a href="/forgot-password" className="mt-1 block font-semibold text-red-700 underline">
                      Request a new link
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="rounded-lg bg-navy py-3 text-sm font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {status === "saving" ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
