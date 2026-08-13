"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { School, LoginFieldErrors } from "@/types/school";
import { useSchools } from "@/lib/useSchools";
import { SchoolSelector } from "./SchoolSelector";
import { createClient } from "@/lib/supabase/client";

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
  const { schools, loading: schoolsLoading, error: schoolsError } = useSchools();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [school, setSchool] = useState<School | null>(null);
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate(): LoginFieldErrors {
    const next: LoginFieldErrors = {};
    if (!email.trim()) next.email = "Enter your email.";
    if (!password) next.password = "Enter your password.";
    if (!school) next.school = "Please select your school.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

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

      if (!school) {
        setErrors({ school: "Please select your school." });
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const {
        data: authData,
        error: signInError,
      } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !authData.user) {
        setErrors({ form: "Incorrect email or password." });
        return;
      }

      const metadata = authData.user.user_metadata as Record<string, unknown> | null;
      const accountSchoolId = typeof metadata?.school_id === "string" ? metadata.school_id : undefined;
      const role = typeof metadata?.role === "string" ? metadata.role : "student";

      if (!accountSchoolId) {
        setErrors({ form: "Your account is missing a school assignment. Contact your admin." });
        return;
      }

      if (accountSchoolId !== school.id) {
        setErrors({ form: "Choose the school where your account is registered." });
        return;
      }

      if (!role || !["student", "teacher", "admin"].includes(role)) {
        setErrors({ form: "Your account role is not valid. Contact your admin." });
        return;
      }

      const landing = role === "teacher" ? "teacher" : role === "admin" ? "admin" : "student";
      window.location.href = `/${landing}/home`;
    } catch {
      setErrors({ form: "Something went wrong. Try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-5">
      {justConfirmed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          Email confirmed! You can now log in.
        </div>
      )}
      {errors.form && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          {errors.form}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16v16H4z" opacity="0" />
              <path d="M22 6l-10 7L2 6" />
              <path d="M2 6h20v12H2z" />
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
          className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors disabled:bg-tile disabled:text-faint
            ${errors.email ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors disabled:bg-tile disabled:text-faint
              ${errors.password ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
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
        {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
      </div>

      <SchoolSelector schools={schools} value={school} onChange={setSchool} error={errors.school} />
      {schoolsLoading && <p className="text-xs text-muted">Loading schools...</p>}
      {schoolsError && <p className="text-xs text-red-500">{schoolsError}</p>}

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
      </button>

      <a href="/forgot-password" className="text-center text-sm text-muted hover:underline">
        Forgot password?
      </a>

      <p className="text-center text-xs text-muted">
        Need an account? <a href="/signup" className="font-semibold text-navy hover:underline">Sign up</a> or contact your school admin.
      </p>
    </form>
  );
}
