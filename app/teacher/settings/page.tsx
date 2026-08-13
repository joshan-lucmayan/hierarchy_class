"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeedbackForm } from "@/components/FeedbackForm";
import { useAccountRequests } from "@/lib/useAccountRequests";

export default function TeacherSettingsPage() {
  const { request } = useAccountRequests();
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleRequest(type: "deactivation" | "deletion") {
    setBusy(type);
    setRequestMessage(null);
    setRequestError(null);
    const ok = await request(type);
    setBusy(null);
    if (ok) {
      setRequestMessage(
        type === "deletion"
          ? "Deletion request submitted. An admin will review it."
          : "Deactivation request submitted. An admin will review it."
      );
    } else {
      setRequestError("Couldn't submit the request. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher settings</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Preferences and account</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Manage your appearance, send feedback, and control your account.
        </p>
      </CornerFrame>

      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-navy">Appearance</h2>
        <div className="mt-4 flex items-center justify-between rounded-[10px] border border-base p-4">
          <div>
            <p className="text-sm font-semibold text-navy">Dark mode</p>
            <p className="mt-1 text-xs text-muted">Switch between light and dark theme.</p>
          </div>
          <ThemeToggle />
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

      <CornerFrame className="rounded-[10px] border border-red-300 bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">Account</h2>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 rounded-[10px] border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">Deactivate account</p>
              <p className="mt-1 text-xs text-muted">Temporarily disable your access. An admin needs to confirm this before it takes effect.</p>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => handleRequest("deactivation")}
              className="shrink-0 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-red-400 hover:text-red-600 disabled:opacity-50"
            >
              {busy === "deactivation" ? "Submitting..." : "Deactivate account"}
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-[10px] border border-base p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">Request account deletion</p>
              <p className="mt-1 text-xs text-muted">Sends a request to your school admin. Your account and data are only removed once they confirm it.</p>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => handleRequest("deletion")}
              className="shrink-0 rounded-full border border-red-300 bg-surface px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {busy === "deletion" ? "Submitting..." : "Request deletion"}
            </button>
          </div>
        </div>
        {requestMessage && <p className="mt-3 text-sm font-semibold text-emerald-600">{requestMessage}</p>}
        {requestError && <p className="mt-3 text-sm text-red-500">{requestError}</p>}
      </CornerFrame>

      <p className="text-center text-xs text-muted">Hierarchy Class · v1.1.0</p>
    </div>
  );
}
