"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { RankBadge } from "@/components/ui/RankBadge";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

type RoleFilter = "all" | "student" | "teacher" | "admin";

const ROLE_TABS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Students" },
  { value: "teacher", label: "Teachers" },
  { value: "admin", label: "Admins" },
];

export default function AdminUsersPage() {
  const { profiles, loading, error, refetch } = useSchoolProfiles();
  const { getStudentRankByProfile } = useClassroomHierarchy();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return profiles.filter((p) => {
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      const matchesQuery =
        !normalized ||
        p.full_name.toLowerCase().includes(normalized) ||
        (p.level_label ?? "").toLowerCase().includes(normalized) ||
        (p.section ?? "").toLowerCase().includes(normalized);
      return matchesRole && matchesQuery;
    });
  }, [profiles, roleFilter, query]);

  const counts = useMemo(() => {
    return {
      all: profiles.length,
      student: profiles.filter((p) => p.role === "student").length,
      teacher: profiles.filter((p) => p.role === "teacher").length,
      admin: profiles.filter((p) => p.role === "admin").length,
    };
  }, [profiles]);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Users</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">School directory</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Every student, teacher, and admin actually registered at your school.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, level, or section..."
            className="w-full max-w-md rounded-3xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm text-navy placeholder:text-muted outline-none"
          />
        </div>
      </CornerFrame>

      <div className="flex flex-wrap gap-2">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setRoleFilter(tab.value)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              roleFilter === tab.value
                ? "border-gold bg-[var(--surface-strong)] text-navy"
                : "border-base bg-surface text-muted hover:border-gold"
            }`}
          >
            {tab.label} ({counts[tab.value]})
          </button>
        ))}
        <button
          type="button"
          onClick={refetch}
          className="ml-auto rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-gold"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-muted">Loading school directory...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-muted">No users match your search.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((person) => (
              <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <img
                    src={person.avatar_url || "/avatars/default-avatar.webp"}
                    alt={person.full_name}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-navy">{person.full_name}</p>
                    <p className="text-xs text-muted">
                      {person.level_label ?? "No level set"}
                      {person.section ? ` · ${person.section}` : ""}
                      {person.role === "teacher" && person.is_librarian ? " · Librarian" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      person.role === "admin"
                        ? "bg-navy text-white"
                        : person.role === "teacher"
                        ? "bg-gold/20 text-gold"
                        : "bg-[var(--surface-strong)] text-muted"
                    }`}
                  >
                    {person.role}
                  </span>
                  {person.role === "student" && (
                    <RankBadge rank={getStudentRankByProfile(person.id) ?? "D"} size="sm" />
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
