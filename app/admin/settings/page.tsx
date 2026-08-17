"use client";

import Link from "next/link";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconCheck, IconX, IconUser, IconPencil } from "@/components/ui/icons";
import { ThemePicker } from "@/components/ThemePicker";
import { FeedbackForm } from "@/components/FeedbackForm";
import { useAccountRequests } from "@/lib/useAccountRequests";
import { APP_VERSION } from "@/lib/version";

export default function AdminSettingsPage() {
  const { requests, loading: requestsLoading, error: requestsError, resolve: resolveRequest } = useAccountRequests();
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">System configuration</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Portal appearance · account management
          </h2>
        </div>
        <Stat
          label="Pending requests"
          value={requestsLoading ? "—" : pendingCount}
          tone={pendingCount > 0 ? "warn" : "muted"}
          hint="Awaiting your decision"
        />
      </div>

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
      {/* HOME DASHBOARD                                              */}
      {/* ============================================================ */}
      <CornerFrame className="p-5">
        <h3 className="section-label">Home Dashboard</h3>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Customize which information appears on your Admin Home and how it is arranged. Widgets are projections of
          your school&apos;s live data - arranging them never changes the data itself.
        </p>
        <div className="mt-4">
          <Link href="/admin/home?customize=1">
            <Button variant="gold" icon={<IconPencil size={13} />}>
              Customize Home
            </Button>
          </Link>
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
      {/* ACCOUNT REQUESTS                                            */}
      {/* ============================================================ */}
      <CornerFrame className="p-5">
        <h3 className="section-label">Account requests</h3>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Deactivation and deletion requests from students and teachers need your confirmation.
        </p>
        <div className="mt-4">
          {requestsLoading ? (
            /* Skeleton: mirror the real request-row geometry. */
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 rounded-[10px] border border-base p-4"
                >
                  <div className="h-10 w-10 shrink-0 rounded-full bg-tile" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-44 rounded-full bg-tile" />
                    <div className="h-2.5 w-28 rounded-full bg-tile" />
                  </div>
                  <div className="h-7 w-28 rounded-full bg-tile" />
                </div>
              ))}
            </div>
          ) : requestsError ? (
            <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
              {requestsError}
            </p>
          ) : requests.length === 0 ? (
            <div className="py-4">
              <EmptyState
                icon={<IconUser size={16} />}
                title="No requests on record"
                desc="Deactivation and deletion requests from students and teachers will appear here."
              />
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => {
                const resolved = request.status !== "pending";
                const typeLabel =
                  request.type === "deletion" ? "Account deletion" : "Account deactivation";
                return (
                  <div
                    key={request.id}
                    className="flex flex-col gap-3 rounded-[10px] border border-base bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={request.requester_name ?? "A user"} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">
                          {request.requester_name ?? "A user"}
                          {request.requester_role && (
                            <span className="font-normal text-muted"> · {request.requester_role}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {typeLabel} requested on {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {resolved ? (
                        <Chip variant={request.status === "approved" ? "success" : "danger"}>
                          {request.status}
                        </Chip>
                      ) : (
                        <>
                          <Button
                            variant="gold"
                            size="sm"
                            icon={<IconCheck size={13} />}
                            onClick={() => resolveRequest(request.id, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<IconX size={13} />}
                            onClick={() => resolveRequest(request.id, "denied")}
                          >
                            Deny
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CornerFrame>

      <p className="pt-1 text-center font-mono-ui text-[10px] uppercase tracking-[0.2em] text-faint">
        Hierarchy Class · v{APP_VERSION}
      </p>
    </div>
  );
}
