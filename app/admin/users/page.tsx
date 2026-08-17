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
import { IconUser, IconRefresh } from "@/components/ui/icons";
import { useRankStore } from "@/lib/rankStore";

// The school directory shows students and teachers only - admin accounts
// are never listed here.
type RoleFilter = "all" | "student" | "teacher";

const ROLE_TABS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Students" },
  { value: "teacher", label: "Teachers" },
];

export default function AdminUsersPage() {
  const { profiles, loading, error, refetch } = useSchoolProfiles({ excludeSelf: true });
  const { rankOf } = useRankStore();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");

  const directory = useMemo(() => profiles.filter((p) => p.role !== "admin"), [profiles]);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return directory.filter((p) => {
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      const matchesQuery =
        !normalized ||
        p.full_name.toLowerCase().includes(normalized) ||
        (p.level_label ?? "").toLowerCase().includes(normalized) ||
        (p.program ?? "").toLowerCase().includes(normalized);
      return matchesRole && matchesQuery;
    });
  }, [directory, roleFilter, query]);

  const counts = useMemo(() => {
    return {
      all: directory.length,
      student: directory.filter((p) => p.role === "student").length,
      teacher: directory.filter((p) => p.role === "teacher").length,
    };
  }, [directory]);

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">School directory</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Users · {counts.all} registered
          </h2>
        </div>
        <Stat
          label="Students"
          value={loading ? "—" : counts.student}
          tone="gold"
          hint={`${counts.teacher} teachers registered`}
        />
      </div>

      {/* ============================================================ */}
      {/* BAND 1 - CONTROL BAR (search · role tabs · refresh)         */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 pr-14 text-sm text-navy outline-none focus:border-gold"
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
                  ? "border-gold-token bg-[var(--surface-strong)] text-navy"
                  : "border-base bg-surface text-muted hover:border-gold-soft"
              }`}
            >
              {tab.label} ({counts[tab.value]})
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" icon={<IconRefresh size={13} />} onClick={refetch} className="ml-auto">
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>
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
            desc="No users match the current search or role filter."
          />
          {(query || roleFilter !== "all") && (
            <div className="mt-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setRoleFilter("all");
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
            {filtered.map((person) => (
              <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={person.full_name} src={person.avatar_url} size="md" profileId={person.id} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{person.full_name}</p>
                    <p className="truncate text-xs text-muted">
                      {[person.educational_level, person.program, person.level_label].filter(Boolean).join(" · ") ||
                        "No level set"}
                      {person.role === "teacher" && person.is_librarian ? " · Librarian" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Chip variant={person.role === "teacher" ? "gold" : "neutral"}>{person.role}</Chip>
                  {person.role === "student" && (
                    <RankBadge rank={rankOf(person.id)?.current_rank ?? "D"} size="sm" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CornerFrame>
      )}
    </div>
  );
}
