"use client";

import { useState } from "react";
import { School } from "@/types/school";
import { MOCK_SCHOOLS } from "@/data/schools";
import { SchoolSelector } from "./SchoolSelector";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "admin", label: "Administrator" },
];

type SignupFieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  school?: string;
  role?: string;
  form?: string;
};

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState<School | null>(null);
  const [role, setRole] = useState("student");
  const [isLibrarian, setIsLibrarian] = useState(false);
  const [errors, setErrors] = useState<SignupFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  function validate() {
    const next: SignupFieldErrors = {};

    if (!name.trim()) next.name = "Enter your full name.";
    if (!email.trim()) next.email = "Enter your email.";
    if (!password) next.password = "Enter your password.";
    if (!school) next.school = "Please select your school.";
    if (!role) next.role = "Choose a role.";

    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage("");

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            is_librarian: role === "teacher" ? isLibrarian : false,
            school_id: school.id,
            school_name: school.name,
          },
        },
      });

      if (error) {
        setErrors({ form: error.message || "Unable to complete sign up." });
        return;
      }

      const user = data?.user;
      const session = data?.session;
      const nextRole = (user?.user_metadata as Record<string, unknown> | null)?.role as string | undefined;
      const landing = nextRole === "teacher" ? "teacher" : nextRole === "admin" ? "admin" : "student";

      if (session) {
        window.location.href = `/${landing}/home`;
        return;
      }

      setStatusMessage(
        "A confirmation email was sent. Verify your address and then sign in to continue."
      );
    } catch (error) {
      setErrors({ form: "Something went wrong. Try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-5">
      {errors.form ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          {errors.form}
        </div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-muted">
          {statusMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-navy">
          Full name
        </label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          disabled={isLoading}
          className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors disabled:bg-surface-50 disabled:text-gray-400
            ${errors.name ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-navy">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isLoading}
          className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors disabled:bg-surface-50 disabled:text-gray-400
            ${errors.email ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-navy">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a strong password"
          disabled={isLoading}
          className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors disabled:bg-surface-50 disabled:text-gray-400
            ${errors.password ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
        />
        {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-navy">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isLoading}
            className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors disabled:bg-surface-50 disabled:text-gray-400
              ${errors.role ? "border-red-400" : "border-base focus:border-navy focus:ring-1 focus:ring-gold"}`}
          >
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <SchoolSelector schools={MOCK_SCHOOLS} value={school} onChange={setSchool} error={errors.school} />
        </div>
      </div>

      {role === "teacher" && (
        <label className="flex items-start gap-2.5 rounded-lg border border-base px-3.5 py-3 text-sm text-navy">
          <input
            type="checkbox"
            checked={isLibrarian}
            onChange={(e) => setIsLibrarian(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">I also manage the school library</span>
            <span className="mt-0.5 block text-xs text-muted">
              Adds Library Management to your teacher account so you can approve pickup requests and track borrowed books.
            </span>
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="group relative mt-1 flex items-center justify-center overflow-hidden rounded-lg bg-navy py-3 text-sm font-bold uppercase tracking-widest text-white transition-opacity disabled:opacity-90"
      >
        {isLoading && (
          <span className="absolute inset-y-0 left-0 w-full origin-left animate-fillbar bg-gold/90" />
        )}
        <span className="relative flex items-center gap-2 justify-center">
          {isLoading ? "Creating account" : "Create account"}
        </span>
      </button>

      <p className="text-center text-xs text-muted">
        Already registered? <a href="/login" className="font-semibold text-navy hover:underline">Log in</a>.
      </p>
    </form>
  );
}
