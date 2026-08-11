"use client";

import { useEffect, useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BannerEditor } from "@/components/admin/BannerEditor";
import { useMyProfile } from "@/lib/useMyProfile";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useAccountRequests } from "@/lib/useAccountRequests";
import { createClient } from "@/lib/supabase/client";

export default function AdminSettingsPage() {
  const { profile } = useMyProfile();
  const { profiles: students } = useSchoolProfiles({ role: "student" });
  const { profiles: teachers } = useSchoolProfiles({ role: "teacher" });
  const { requests, loading: requestsLoading, error: requestsError, resolve: resolveRequest } = useAccountRequests();
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolAbbr, setSchoolAbbr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (supabase.from("schools") as any)
      .select("name, abbreviation")
      .eq("id", profile.school_id)
      .single()
      .then(({ data }: any) => {
        setSchoolName(data?.name ?? null);
        setSchoolAbbr(data?.abbreviation ?? null);
      });
  }, [profile]);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Admin settings</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">System configuration</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          School overview, appearance, and account management for your portal.
        </p>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">My school</h2>
        <p className="mt-1 text-xs text-muted">Overview of the school registered to your admin account.</p>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-gold bg-navy text-base font-bold text-gold">
            {schoolAbbr ?? "—"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy">{schoolName ?? "Loading..."}</p>
            <p className="mt-1 text-xs text-muted">Live data from the schools table</p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-600">
            Active
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
            <p className="text-2xl font-bold text-navy">{students.length}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">Students</p>
          </div>
          <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
            <p className="text-2xl font-bold text-navy">{teachers.length}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">Teachers</p>
          </div>
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Appearance</h2>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-base p-4">
          <div>
            <p className="text-sm font-semibold text-navy">Dark mode</p>
            <p className="mt-1 text-xs text-muted">Switch between light and dark theme.</p>
          </div>
          <ThemeToggle />
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Site banner</h2>
        <div className="mt-4">
          <BannerEditor />
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Account requests</h2>
        <p className="mt-1 text-xs text-muted">Deactivation and deletion requests from students and teachers need your confirmation.</p>
        <div className="mt-4 space-y-3">
          {requestsLoading ? (
            <p className="rounded-2xl border border-base p-4 text-sm text-muted">Loading requests...</p>
          ) : requestsError ? (
            <p className="rounded-2xl border border-base p-4 text-sm text-red-500">{requestsError}</p>
          ) : requests.length === 0 ? (
            <p className="rounded-2xl border border-base p-4 text-sm text-muted">No requests on record.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {request.requester_name ?? "A user"} <span className="font-normal text-muted">· {request.requester_role}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {request.type === "deletion" ? "Account deletion" : "Account deactivation"} requested on{" "}
                    {new Date(request.created_at).toLocaleDateString()}
                    {request.status !== "pending" && (
                      <span className="ml-1 font-semibold text-muted">· {request.status}</span>
                    )}
                  </p>
                </div>
                {request.status === "pending" ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => resolveRequest(request.id, "approved")}
                      className="rounded-full border border-red-300 bg-surface px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/10"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveRequest(request.id, "denied")}
                      className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
                    >
                      Deny
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                    {request.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </CornerFrame>

      <p className="text-center text-xs text-muted">Hierarchy Class · v0.2.0</p>
    </div>
  );
}
