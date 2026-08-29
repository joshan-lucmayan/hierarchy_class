import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types/supabase";

/**
 * The project's Supabase client carries the database type parameter. Accept
 * any client whose auth API matches so both the typed client (web/native) and
 * a generic client work here.
 */
type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

/**
 * Shared password-login flow for the web form (components/auth/LoginForm.tsx)
 * and the Android auth screens (components/native/NativeLogin.tsx).
 *
 * Handles sign-in, email-confirmation enforcement, and profile-role
 * resolution exactly once, in one place, so both platforms enforce the same
 * policy (profiles table = database truth; user_metadata is never trusted).
 *
 * Returns a discriminated result:
 *   - ok:false + resendEmail set  -> the account's email isn't confirmed
 *   - ok:false + resendEmail null -> generic / other failure
 *   - ok:true + role              -> the resolved role for routing
 */

export type PasswordLoginResult =
  | { ok: true; role: Role; resendEmail: null }
  | { ok: false; error: string; resendEmail: string | null; network?: boolean };

export async function resolvePasswordLogin(
  supabase: AnySupabaseClient,
  email: string,
  password: string
): Promise<PasswordLoginResult> {
  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !authData.user) {
    const message = signInError?.message ?? "Incorrect email or password.";
    const isNetwork = /fetch|Network|network|ERR_INTERNET|Failed/i.test(message);
    if (isNetwork) {
      // Desktop keeps its existing message; Android (NativeLogin) reads the
      // `network` flag and shows an explicit offline state instead.
      return { ok: false, error: "Incorrect email or password.", resendEmail: null, network: true };
    }
    if (/not confirmed|confirm/i.test(message)) {
      return {
        ok: false,
        error:
          "Your email isn't confirmed yet. Confirm the link we sent you, or resend it below.",
        resendEmail: email.trim(),
      };
    }
    return { ok: false, error: "Incorrect email or password.", resendEmail: null };
  }

  // Email confirmation is enforced server-side (login itself refuses
  // unconfirmed accounts; the web middleware re-checks on every request).
  if (!authData.user.email_confirmed_at) {
    return {
      ok: false,
      error:
        "Your email isn't confirmed yet. Confirm the link we sent you, or resend it below.",
      resendEmail: email.trim(),
    };
  }

  // Resolve the role from the profiles table (database truth) - never
  // from user_metadata, which the user can edit themselves.
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("user_id", authData.user.id)
    .maybeSingle()) as { data: { role: string; school_id: string } | null };

  if (!profile) {
    return {
      ok: false,
      error: "Your account isn't set up yet. Contact your school admin.",
      resendEmail: null,
    };
  }

  const role = profile.role as Role;
  if (role !== "student" && role !== "teacher" && role !== "admin") {
    return {
      ok: false,
      error: "Your account role is not valid. Contact your admin.",
      resendEmail: null,
    };
  }

  return { ok: true, role, resendEmail: null };
}
