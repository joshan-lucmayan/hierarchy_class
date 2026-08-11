"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useFriendsStore } from "@/lib/friendsStore";
import { useLeaderboard, rankFromAverage } from "@/lib/useLeaderboard";
import type { ProfileRow } from "@/types/supabase";
import { RankBadge } from "@/components/ui/RankBadge";

const RESULT_LIMIT = 5;

export function QuickSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { profiles: students } = useSchoolProfiles({ role: "student" });
  const { profiles: teachers } = useSchoolProfiles({ role: "teacher" });
  const { friendIds } = useFriendsStore();
  const { averageOf } = useLeaderboard();
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const studentResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalized = query.toLowerCase();
    return students
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(normalized) ||
          (s.section ?? "").toLowerCase().includes(normalized) ||
          (s.level_label ?? "").toLowerCase().includes(normalized) ||
          (s.favorite_subject ?? "").toLowerCase().includes(normalized)
      )
      .slice(0, RESULT_LIMIT);
  }, [students, query]);

  const teacherResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalized = query.toLowerCase();
    return teachers
      .filter(
        (t) =>
          t.full_name.toLowerCase().includes(normalized) ||
          (t.favorite_subject ?? "").toLowerCase().includes(normalized)
      )
      .slice(0, RESULT_LIMIT);
  }, [teachers, query]);

  const showDropdown = focused && query.trim().length > 0;
  const hasResults = studentResults.length > 0 || teacherResults.length > 0;

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setFocused(true);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setFocused(false), 150);
  }

  function goToPerson(person: ProfileRow) {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setFocused(false);
    setQuery("");
    router.push(`/student/search?profile=${person.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const q = query.trim();
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
      setFocused(false);
      if (q) {
        // Enter = go to the full results page with the query applied.
        router.push(`/student/search?q=${encodeURIComponent(q)}`);
      }
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search"
          className="w-full rounded-full bg-[var(--surface-strong)] py-2.5 pl-11 pr-4 text-sm text-navy placeholder:text-muted outline-none transition focus:ring-1 focus:ring-gold"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-2xl bg-surface py-2 shadow-2xl">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-muted">No matching profiles found.</p>
          ) : (
            <>
              {studentResults.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => goToPerson(student)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <img
                    src={student.avatar_url || "/avatars/default-avatar.webp"}
                    alt={student.full_name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{student.full_name}</p>
                    <p className="truncate text-xs text-muted">
                      {[student.level_label, student.section].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {friendIds.includes(student.id) && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold">Friend</span>
                  )}
                  <RankBadge rank={rankFromAverage(averageOf(student.id))} size="sm" />
                </button>
              ))}
              {teacherResults.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => goToPerson(teacher)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <img
                    src={teacher.avatar_url || "/avatars/default-avatar.webp"}
                    alt={teacher.full_name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{teacher.full_name}</p>
                    <p className="truncate text-xs text-gold">Faculty</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
