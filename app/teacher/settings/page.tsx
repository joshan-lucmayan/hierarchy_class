"use client";

import { useState } from "react";
import Link from "next/link";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { ThemePicker } from "@/components/ThemePicker";
import { FeedbackForm } from "@/components/FeedbackForm";
import { IconPencil } from "@/components/ui/icons";
import { useAccountRequests } from "@/lib/useAccountRequests";
import { APP_VERSION } from "@/lib/version";

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
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Preferences and account</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Teacher settings · appearance, feedback, account
          </h2>
        </div>
      </div>

      {/* ============================================================ */}
      {/* HOME DASHBOARD                                              */}
      {/* ============================================================ */}
      <CornerFrame className="p-5">
        <h3 className="section-label">Home Dashboard</h3>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Customize which information appears on your Home and how it is arranged. Widgets are projections of your
          live data - arranging them never changes the data itself.
        </p>
        <div className="mt-4">
          <Link href="/teacher/home?customize=1">
            <Button variant="gold" icon={<IconPencil size={13} />}>
              Customize Home
            </Button>
          </Link>
        </div>
      </CornerFrame>

      {/* ============================================================ */}
      {/* APPEARANCE                                                  */}
      {/* ============================================================ */}
      <CornerFrame className="p-5">
        <h3 className="section-label">Appearance</h3>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Choose the theme you want to use the app in. Midnight is the default palette; Rose is the soft alternative.
        </p>
        <div className="mt-4">
          <ThemePicker />
        </div>
      </CornerFrame>

      {/* ============================================================ */}
      {/* FEEDBACK & REPORT                                           */}
      {/* ============================================================ */}
      <CornerFrame className="p-5">
        <h3 className="section-label">Feedback &amp; report</h3>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Send feedback or report a problem. Your name, role, and the current page are included so the developer can follow up.
        </p>
        <div className="mt-4">
          <FeedbackForm />
        </div>
      </CornerFrame>

      {/* ============================================================ */}
      {/* ACCOUNT                                                     */}
      {/* ============================================================ */}
      <CornerFrame tone="warn" className="p-5">
        <h3 className="section-label">Account</h3>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          These actions send a request to your school admin. Nothing changes until they confirm it.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 rounded-[10px] border border-base bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">Deactivate account</p>
              <p className="mt-1 text-xs text-muted">
                Temporarily disable your access. An admin needs to confirm this before it takes effect.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => handleRequest("deactivation")}
              className="shrink-0"
            >
              {busy === "deactivation" ? "Submitting..." : "Deactivate account"}
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-[10px] border border-base bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">Request account deletion</p>
              <p className="mt-1 text-xs text-muted">
                Sends a request to your school admin. Your account and data are only removed once they confirm it.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              disabled={busy !== null}
              onClick={() => handleRequest("deletion")}
              className="shrink-0"
            >
              {busy === "deletion" ? "Submitting..." : "Request deletion"}
            </Button>
          </div>
        </div>
        {requestMessage && <p className="mt-3 text-sm font-semibold text-gold-token">{requestMessage}</p>}
        {requestError && <p className="mt-3 text-sm text-warn">{requestError}</p>}
      </CornerFrame>

      <p className="pt-1 text-center font-mono-ui text-[10px] uppercase tracking-[0.2em] text-faint">
        Hierarchy Class · v{APP_VERSION}
      </p>
    </div>
  );
}
