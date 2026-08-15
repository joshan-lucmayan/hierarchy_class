"use client";

import { CornerFrame } from "@/components/ui/CornerFrame";
import { ThemePicker } from "@/components/ThemePicker";
import { FeedbackForm } from "@/components/FeedbackForm";
import { useAccountRequests } from "@/lib/useAccountRequests";
import { APP_VERSION } from "@/lib/version";

export default function AdminSettingsPage() {
  const { requests, loading: requestsLoading, error: requestsError, resolve: resolveRequest } = useAccountRequests();

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Admin settings</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">System configuration</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Appearance and account management for your portal.
        </p>
      </CornerFrame>

      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Appearance</h2>
        <p className="mt-1 text-xs text-muted">Choose the theme you want to use the app in.</p>
        <div className="mt-4">
          <ThemePicker />
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Feedback &amp; report</h2>
        <p className="mt-1 text-xs text-muted">
          Send feedback or report a problem. Your name, role, and the current page are included so the developer can follow up.
        </p>
        <div className="mt-4">
          <FeedbackForm />
        </div>
      </CornerFrame>

      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Account requests</h2>
        <p className="mt-1 text-xs text-muted">Deactivation and deletion requests from students and teachers need your confirmation.</p>
        <div className="mt-4 space-y-3">
          {requestsLoading ? (
            <p className="rounded-[10px] border border-base p-4 text-sm text-muted">Loading requests...</p>
          ) : requestsError ? (
            <p className="rounded-[10px] border border-base p-4 text-sm text-red-500">{requestsError}</p>
          ) : requests.length === 0 ? (
            <p className="rounded-[10px] border border-base p-4 text-sm text-muted">No requests on record.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-[10px] border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
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

      <p className="text-center text-xs text-muted">Hierarchy Class · v{APP_VERSION}</p>
    </div>
  );
}
