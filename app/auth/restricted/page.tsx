"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingBackground } from "@/components/landing/Background";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { submitAppeal } from "@/lib/bridgeClient";
import type { AccountAppealRow } from "@/types/supabase";

type State = "checking" | "restricted" | "notRestricted" | "missing";

/**
 * Shown to signed-in users whose account was temporarily restricted by a
 * school administrator (middleware redirects them here). The user can submit
 * one appeal, which a same-school admin reviews. Restriction is NOT
 * deactivation: the user stays authenticated and can always see this page.
 */
export default function RestrictedPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [appeals, setAppeals] = useState<AccountAppealRow[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "submit" | "signout">(null);
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
      // Authorization comes from the profiles table (database truth), never
      // from user_metadata.
      const { data: profile } = (await supabase
        .from("profiles")
        .select("id, restricted_at, role")
        .eq("user_id", userData.user.id)
        .maybeSingle()) as { data: { id: string; restricted_at: string | null; role: string } | null };
      if (cancelled) return;
      if (!profile) {
        setState("missing");
        return;
      }
      if (!profile.restricted_at) {
        // Not restricted anymore - go home if we can resolve the role.
        const normalized =
          profile.role === "teacher" || profile.role === "admin" || profile.role === "student"
            ? profile.role
            : null;
        if (normalized) router.replace(`/${normalized}/home`);
        else setState("missing");
        return;
      }

      const { data: myAppeals } = (await supabase
        .from("account_appeals")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10)) as { data: AccountAppealRow[] | null };
      if (cancelled) return;
      setAppeals(myAppeals ?? []);
      setState("restricted");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const pendingAppeal = appeals.find((a) => a.status === "pending") ?? null;
  const latestAppeal = appeals[0] ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy("submit");
    setError(null);
    const result = await submitAppeal(reason);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Couldn't submit your appeal.");
      return;
    }
    setReason("");
    // Refresh the appeal list to show the pending state.
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = (await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userData.user.id)
        .maybeSingle()) as { data: { id: string } | null };
      if (profile) {
        const { data: myAppeals } = (await supabase
          .from("account_appeals")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(10)) as { data: AccountAppealRow[] | null };
        setAppeals(myAppeals ?? []);
      }
    }
  }

  async function handleSignOut() {
    setBusy("signout");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (state === "missing") {
    return (
      <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
        <LandingBackground />
        <div className="relative z-[2] flex w-full justify-center">
          <p className="text-sm text-muted">
            Please{" "}
            <a href="/login" className="font-semibold text-navy hover:underline">
              sign in
            </a>{" "}
            first.
          </p>
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

  const hasResolvedAppeal = latestAppeal && latestAppeal.status !== "pending";

  return (
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-12">
      <LandingBackground />
      <div className="relative z-[2] flex w-full max-w-md justify-center">
        <div className="w-full rounded-[10px] border border-base bg-surface p-7">
          <div className="mb-3 h-1 w-10 rounded-full bg-warn" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warn">Account restricted</p>
          <h1 className="mt-2 text-2xl font-bold text-navy">Your account is temporarily restricted.</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            We&apos;re sorry, but your account was temporarily restricted from accessing the app while a school
            administrator reviews it. If you believe this was a mistake, you can appeal below and an administrator
            will review your case.
          </p>

          {pendingAppeal ? (
            <div className="mt-6 rounded-[10px] border border-gold-soft bg-gold-soft/40 p-4">
              <p className="text-sm font-semibold text-navy">Appeal submitted</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Your appeal is waiting for review by a school administrator. You&apos;ll be able to use the app again
                if it&apos;s approved.
              </p>
            </div>
          ) : hasResolvedAppeal ? (
            <div
              className={`mt-6 rounded-[10px] border p-4 ${
                latestAppeal.status === "approved"
                  ? "border-gold-soft bg-gold-soft/40"
                  : "border-warn-soft bg-warn-soft/40"
              }`}
            >
              <p className="text-sm font-semibold text-navy">
                Your appeal was {latestAppeal.status === "approved" ? "approved" : "not approved"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {latestAppeal.status === "approved"
                  ? "A school administrator restored your access. Sign in again to continue."
                  : "Your account remains restricted. Contact your school if you believe this is an error."}
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy === "signout"}
                className="mt-3 rounded-full border border-base px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold disabled:opacity-50"
              >
                {busy === "signout" ? "Signing out..." : "Sign out and try again"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy">
                Submit an appeal
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Explain why your account should be restored..."
                className="w-full rounded-[10px] border border-base bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-gold"
              />
              {error && <p className="text-sm text-warn">{error}</p>}
              <Button
                variant="gold"
                className="w-full"
                loading={busy === "submit"}
                disabled={busy !== null || !reason.trim()}
                type="submit"
              >
                Submit appeal
              </Button>
              <Button variant="outline" className="w-full" loading={busy === "signout"} disabled={busy !== null} onClick={handleSignOut}>
                Sign out
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
