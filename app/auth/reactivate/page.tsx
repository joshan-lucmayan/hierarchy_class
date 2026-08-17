"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingBackground } from "@/components/landing/Background";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { reactivateAccount } from "@/app/actions/account";

/**
 * Shown to signed-in users whose account is deactivated (middleware redirects
 * them here). Reactivation is explicit - the user must choose to reactivate;
 * simply logging in does NOT silently reactivate the account.
 */
export default function ReactivatePage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "deactivated" | "missing">("checking");
  const [busy, setBusy] = useState<null | "reactivate" | "stay">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: userData }) => {
      if (cancelled) return;
      if (!userData.user) {
        setState("missing");
        return;
      }
      const { data: profile } = (await supabase
        .from("profiles")
        .select("deactivated_at, role")
        .eq("user_id", userData.user.id)
        .maybeSingle()) as { data: { deactivated_at: string | null; role: string } | null };
      if (cancelled) return;
      if (!profile) {
        setState("missing");
        return;
      }
      if (!profile.deactivated_at) {
        // Already active - go home.
        const role = profile.role === "teacher" ? "teacher" : profile.role === "admin" ? "admin" : "student";
        router.replace(`/${role}/home`);
        return;
      }
      setState("deactivated");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleReactivate() {
    setBusy("reactivate");
    setError(null);
    const result = await reactivateAccount();
    if (!result.ok) {
      setError(result.error ?? "Couldn't reactivate your account.");
      setBusy(null);
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const role = user?.user_metadata?.role === "teacher" ? "teacher" : user?.user_metadata?.role === "admin" ? "admin" : "student";
    router.replace(`/${role}/home`);
  }

  async function handleStayDeactivated() {
    setBusy("stay");
    setError(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login?deactivated=1");
  }

  if (state === "missing") {
    return (
      <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
        <LandingBackground />
        <div className="relative z-[2] flex w-full justify-center">
          <p className="text-sm text-muted">Please sign in first.</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-token">Welcome back</p>
          <h1 className="mt-2 text-2xl font-bold text-navy">Your account is currently deactivated.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Would you like to reactivate your account and continue using Hierarchy Class?
          </p>

          <div className="mt-6 space-y-2">
            <Button variant="gold" className="w-full" loading={busy === "reactivate"} disabled={busy !== null} onClick={handleReactivate}>
              Reactivate Account
            </Button>
            <Button variant="outline" className="w-full" loading={busy === "stay"} disabled={busy !== null} onClick={handleStayDeactivated}>
              Stay Deactivated
            </Button>
          </div>

          {error && <p className="mt-4 text-sm text-warn">{error}</p>}
        </div>
      </div>
    </main>
  );
}
