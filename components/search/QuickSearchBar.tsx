"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useFriendsStore } from "@/lib/friendsStore";
import { useProgramByStudent } from "@/lib/useAcademicIdentity";
import { useRankStore } from "@/lib/rankStore";
import type { ProfileRow } from "@/types/supabase";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ProfileModal } from "@/components/profile/ProfileModal";

const RESULT_LIMIT = 5;

export function QuickSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [viewing, setViewing] = useState<ProfileRow | null>(null);
  const { profiles: students } = useSchoolProfiles({ role: "student", excludeSelf: true });
  const { profiles: teachers } = useSchoolProfiles({ role: "teacher", excludeSelf: true });
  const { friendIds } = useFriendsStore();
  const { rankOf } = useRankStore();
  const programByStudent = useProgramByStudent();
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const studentResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalized = query.toLowerCase();
    return students
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(normalized) ||
          (s.program ?? "").toLowerCase().includes(normalized) ||
          (s.level_label ?? "").toLowerCase().includes(normalized) ||
          (s.educational_level ?? "").toLowerCase().includes(normalized) ||
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
    // Clicking a result opens that person's profile in place, over the current
    // menu - the user never leaves the page they're on. The full profile page
    // is still reachable from inside the preview or via Enter (results page).
    setViewing(person);
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

  function ResultRow({
    person,
    subtitle,
    trailing,
  }: {
    person: ProfileRow;
    subtitle: string;
    trailing?: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={() => goToPerson(person)}
        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-strong)]"
      >
        <UserAvatar name={person.full_name} src={person.avatar_url} size="md" profileId={person.id} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-navy">{person.full_name}</span>
            {friendIds.includes(person.id) && (
              <span className="shrink-0 rounded-full border border-sealion/50 bg-sealion/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-sealion">
                Friend
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
        </span>
        {trailing}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="group relative">
        {/* Search icon: magnifying glass using the muted token so it blends
            with the placeholder text and feels like part of the search control.
            On focus it lifts to --text (matching typed text), staying restrained
            — no gold, no glow. Rounded caps + joins keep the handle and lens
            crisp at 20 px. The handle starts at (16,16) — past the circle's
            outer stroke edge — so it's never swallowed by the lens. */}
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 z-10 text-[var(--muted)] transition-colors group-focus-within:text-[var(--text)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M16 16L21 21" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search students and teachers"
          className="w-full rounded-md border border-line bg-tile py-2.5 pl-11 pr-4 text-[13px] text-navy placeholder:text-[var(--muted)] outline-none transition focus:border-sealion"
        />
      </div>

      {viewing && <ProfileModal person={viewing} onClose={() => setViewing(null)} />}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-[10px] border border-base bg-surface">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-muted">No matching profiles found.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1.5">
              {studentResults.length > 0 && (
                <>
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">
                    Students
                  </p>
                  {studentResults.map((student) => (
                    <ResultRow
                      key={student.id}
                      person={student}
                      subtitle={
                        [student.educational_level, student.program ?? programByStudent[student.id], student.level_label]
                          .filter(Boolean)
                          .join(" · ") || "Student"
                      }
                      trailing={<RankBadge rank={rankOf(student.id)?.current_rank ?? "D"} size="sm" />}
                    />
                  ))}
                </>
              )}
              {teacherResults.length > 0 && (
                <>
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">
                    Faculty
                  </p>
                  {teacherResults.map((teacher) => (
                    <ResultRow
                      key={teacher.id}
                      person={teacher}
                      subtitle={teacher.favorite_subject ? `Faculty · ${teacher.favorite_subject}` : "Faculty"}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
