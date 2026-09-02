"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Modal } from "@/components/ui/Modal";
import { IconUser, IconRefresh } from "@/components/ui/icons";
import { useRankStore } from "@/lib/rankStore";
import { adminRestrictUser, adminUnrestrictUser } from "@/lib/bridgeClient";
import type { ProfileRow } from "@/types/supabase";

// The school directory shows students and teachers only - admin accounts
// are never listed here (they are platform-owner managed).
type RoleFilter = "all" | "student" | "teacher";

const ROLE_TABS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Students" },
  { value: "teacher", label: "Teachers" },
];

type SortMode = "name" | "recent";

export default function AdminUsersPage() {
  const { profiles, loading, error, refetch } = useSchoolProfiles({
    excludeSelf: true,
    includeDeactivated: true,
  });
  const { rankOf } = useRankStore();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [accountFilter, setAccountFilter] = useState<"all" | "active" | "deactivated">("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restrictTarget, setRestrictTarget] = useState<ProfileRow | null>(null);
  const [restrictReason, setRestrictReason] = useState("");

  const directory = useMemo(() => profiles.filter((p) => p.role !== "admin"), [profiles]);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    const rows = directory.filter((p) => {
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      const matchesAccount =
        accountFilter === "all" ||
        (accountFilter === "active" ? !p.deactivated_at : !!p.deactivated_at);
      const matchesQuery =
        !normalized ||
        p.full_name.toLowerCase().includes(normalized) ||
        (p.level_label ?? "").toLowerCase().includes(normalized) ||
        (p.program ?? "").toLowerCase().includes(normalized) ||
        (p.student_id ?? "").toLowerCase().includes(normalized) ||
        (p.faculty_id ?? "").toLowerCase().includes(normalized);
      return matchesRole && matchesAccount && matchesQuery;
    });
    return sortMode === "recent"
      ? [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
      : rows;
  }, [directory, roleFilter, accountFilter, query, sortMode]);

  const counts = useMemo(() => {
    return {
      all: directory.length,
      student: directory.filter((p) => p.role === "student").length,
      teacher: directory.filter((p) => p.role === "teacher").length,
      deactivated: directory.filter((p) => p.deactivated_at).length,
    };
  }, [directory]);

  // Restriction is the ONLY admin account-lifecycle action here: deactivation
  // is self-service (users reactivate themselves), permanent deletion goes
  // through the admin-approved deletion-request flow, and admin accounts are
  // platform-owner managed. Restricting a suspicious account routes them to
  // /auth/restricted where they can appeal.
  async function handleRestriction(profile: ProfileRow, restrict: boolean) {
    setBusyId(profile.id);
    setActionError(null);
    const result = restrict
      ? await adminRestrictUser(profile.id, restrictReason.trim() || undefined)
      : await adminUnrestrictUser(profile.id);
    setBusyId(null);
    setRestrictTarget(null);
    setRestrictReason("");
    if (!result.ok) {
      setActionError(result.error ?? "Couldn't update the account.");
      return;
    }
    refetch();
  }

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">School directory</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Users · {counts.all} registered · {counts.deactivated} deactivated
          </h2>
        </div>
        <Stat
          label="Students"
          value={loading ? "-" : counts.student}
          tone="accent"
          hint={`${counts.teacher} teachers registered`}
        />
      </div>

      {/* ============================================================ */}
      {/* BAND 1 - CONTROL BAR (search · filters · sort · refresh)    */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, level, or ID..."
            className="w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 pr-14 text-sm text-navy outline-none focus:border-accent"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
            {filtered.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setRoleFilter(tab.value)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                roleFilter === tab.value
                  ? "border-accent-token bg-[var(--surface-strong)] text-navy"
                  : "border-base bg-surface text-muted hover:border-accent-soft"
              }`}
            >
              {tab.label} ({counts[tab.value]})
            </button>
          ))}
          {(
            [
              { value: "active", label: "Active" },
              { value: "deactivated", label: "Deactivated" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAccountFilter((prev) => (prev === opt.value ? "all" : opt.value))}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                accountFilter === opt.value
                  ? "border-warn bg-[var(--surface-strong)] text-warn"
                  : "border-base bg-surface text-muted hover:border-accent-soft"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSortMode((prev) => (prev === "recent" ? "name" : "recent"))}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              sortMode === "recent"
                ? "border-accent-token bg-[var(--surface-strong)] text-navy"
                : "border-base bg-surface text-muted hover:border-accent-soft"
            }`}
            title="Sort by newest registrations or by name"
          >
            {sortMode === "recent" ? "Recently registered" : "By name"}
          </button>
        </div>
        <Button variant="outline" size="sm" icon={<IconRefresh size={13} />} onClick={refetch} className="ml-auto">
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>
      )}
      {actionError && (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{actionError}</p>
      )}

      {loading ? (
        /* Skeleton: mirror the real directory-row geometry. */
        <CornerFrame className="p-5">
          <div className="space-y-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 py-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-tile" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-44 rounded-full bg-tile" />
                  <div className="h-2.5 w-28 rounded-full bg-tile" />
                </div>
                <div className="h-5 w-16 rounded-full bg-tile" />
              </div>
            ))}
          </div>
        </CornerFrame>
      ) : directory.length === 0 ? (
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconUser size={16} />}
            title="No users yet"
            desc="Students and teachers appear here as soon as they sign up and are verified in your school."
          />
        </CornerFrame>
      ) : filtered.length === 0 ? (
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconUser size={16} />}
            title="No users found"
            desc="No users match the current search or filters."
          />
          {(query || roleFilter !== "all" || accountFilter !== "all") && (
            <div className="mt-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setRoleFilter("all");
                  setAccountFilter("all");
                }}
              >
                Clear search &amp; filters
              </Button>
            </div>
          )}
        </CornerFrame>
      ) : (
        <CornerFrame className="p-5">
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((person) => {
              const deactivated = !!person.deactivated_at;
              const restricted = !!person.restricted_at;
              return (
                <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar name={person.full_name} src={person.avatar_url} size="md" profileId={person.id} />
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${deactivated ? "text-muted line-through decoration-faint" : "text-navy"}`}>
                        {person.full_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {[person.educational_level, person.program, person.level_label].filter(Boolean).join(" · ") ||
                          "No level set"}
                        {person.role === "teacher" && person.is_librarian ? " · Librarian" : ""}
                        {(person.student_id || person.faculty_id) && (
                          <span className="ml-1 font-mono-ui text-[10px] text-faint">
                            · {person.student_id ?? person.faculty_id}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {deactivated && (
                      <Chip variant="danger">
                        Deactivated {person.deactivated_at ? new Date(person.deactivated_at).toLocaleDateString() : ""}
                      </Chip>
                    )}
                    {restricted && (
                      <Chip variant="warn">
                        Restricted {person.restricted_at ? new Date(person.restricted_at).toLocaleDateString() : ""}
                      </Chip>
                    )}
                    <Chip variant={person.role === "teacher" ? "accent" : "neutral"}>{person.role}</Chip>
                    {person.role === "student" && (
                      <RankBadge rank={rankOf(person.id)?.current_rank ?? "D"} size="sm" />
                    )}
                    <Button
                      variant={restricted ? "accent" : "danger"}
                      size="sm"
                      loading={busyId === person.id}
                      disabled={busyId !== null}
                      onClick={() => {
                        if (restricted) {
                          handleRestriction(person, false);
                        } else {
                          setRestrictTarget(person);
                          setRestrictReason("");
                        }
                      }}
                    >
                      {restricted ? "Restore access" : "Restrict"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 border-t border-base pt-3 text-[11px] leading-5 text-muted">
            Restricting temporarily blocks a suspicious account (they can still sign in, but only reach the
            appeal flow). Deactivation is self-service by the user, and permanent deletion stays a separate,
            admin-approved request. Admin accounts are managed by the platform owner.
          </p>
        </CornerFrame>
      )}

      {restrictTarget && (
        <Modal
          onClose={() => setRestrictTarget(null)}
          eyebrow="Restrict account"
          description={`Temporarily restrict ${restrictTarget.full_name}?`}
          maxWidth="max-w-sm"
        >
          <p className="text-sm leading-6 text-muted">
            The user will still be able to sign in, but will only reach the restriction page where they can submit
            an appeal. You can restore their access anytime from this directory.
          </p>
          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Reason (optional, sent with the notice)
          </label>
          <textarea
            value={restrictReason}
            onChange={(e) => setRestrictReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Possible unauthorized account activity"
            className="mt-1.5 w-full rounded-[10px] border border-base bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-accent"
          />
          <div className="mt-5 flex gap-2">
            <Button
              variant="danger"
              loading={busyId === restrictTarget.id}
              onClick={() => handleRestriction(restrictTarget, true)}
            >
              Restrict account
            </Button>
            <Button variant="outline" onClick={() => setRestrictTarget(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
