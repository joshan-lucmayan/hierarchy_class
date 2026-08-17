"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingBackground } from "@/components/landing/Background";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { homePathForRole } from "@/lib/authz";

/**
 * Safe state for an authenticated Supabase user who has no profiles row.
 *
 * The middleware redirects these accounts here instead of silently allowing
 * access or auto-creating a profile from client data. The user can sign out;
 * fixing the account is an admin/platform-owner action.
 */
export default function IncompletePage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "incomplete" | "fine">("checking");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: userData }) => {
      if (cancelled) return;
      if (!userData.user) {
        setState("fine");
        return;
      }
      const { data: profile } = (await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .maybeSingle()) as { data: { role: string } | null };
      if (cancelled) return;
      if (!profile) {
        setState("incomplete");
        return;
      }
      // They actually have a profile - go to their home.
      const role =
        profile.role === "teacher" || profile.role === "admin" || profile.role === "student"
          ? profile.role
          : null;
      if (role) {
        router.replace(homePathForRole(role));
      } else {
        setState("incomplete");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (state === "fine") {
    return (
      <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
        <LandingBackground />
        <div className="relative z-[2] flex w-full justify-center">
          <p className="text-sm text-muted">Please sign in first.</p>
        </div>
      </main>
    );
  }

  if (state === "checking") {
    return (
      <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
        <LandingBackground />
        <div className="relative z-[2] flex w-full justify-center">
          <p className="text-sm text-muted">Checking your account...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
      <LandingBackground />
      <div className="relative z-[2] flex w-full max-w-md justify-center">
        <div className="w-full rounded-[10px] border border-base bg-surface p-7">
          <div className="mb-3 h-1 w-10 rounded-full bg-gold-token" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-token">Account not ready</p>
          <h1 className="mt-2 text-2xl font-bold text-navy">Your account isn&apos;t set up yet.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            We couldn&apos;t find a school profile for this account. Please contact your school
            administrator or the platform team so it can be completed.
          </p>

          <div className="mt-6 space-y-2">
            <Button variant="outline" className="w-full" loading={signingOut} disabled={signingOut} onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
