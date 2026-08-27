"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<ProfileRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const { profiles: students } = useSchoolProfiles({ role: "student", excludeSelf: true });
  const { profiles: teachers } = useSchoolProfiles({ role: "teacher", excludeSelf: true });
  const { friendIds } = useFriendsStore();
  const { rankOf } = useRankStore();
  const programByStudent = useProgramByStudent();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) inputRef.current?.focus({ preventScroll: true });
  }, [mounted]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const hasResults = studentResults.length > 0 || teacherResults.length > 0;

  function goToPerson(person: ProfileRow) {
    setViewing(person);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const q = query.trim();
      if (q) {
        onClose();
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
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-strong)] max-[767px]:min-h-[44px]"
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

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-surface animate-modal-in"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingRight: "env(safe-area-inset-right)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-base bg-surface px-4 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
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
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search students and teachers"
              className="w-full rounded-full border border-line bg-tile py-3 pl-11 pr-4 text-[16px] text-navy placeholder:text-muted outline-none transition focus:border-sealion"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-tile text-muted transition hover:border-sealion active:scale-[0.96]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-surface px-4 py-4">
          {!query.trim() ? (
            <p className="py-8 text-center text-sm text-muted">Type to search students and teachers.</p>
          ) : !hasResults ? (
            <p className="py-8 text-center text-sm text-muted">No matching profiles found.</p>
          ) : (
            <div className="space-y-6">
              {studentResults.length > 0 && (
                <div>
                  <p className="px-4 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">Students</p>
                  <div className="overflow-hidden rounded-[16px] border border-base bg-surface">
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
                  </div>
                </div>
              )}
              {teacherResults.length > 0 && (
                <div>
                  <p className="px-4 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">Faculty</p>
                  <div className="overflow-hidden rounded-[16px] border border-base bg-surface">
                    {teacherResults.map((teacher) => (
                      <ResultRow
                        key={teacher.id}
                        person={teacher}
                        subtitle={teacher.favorite_subject ? `Faculty · ${teacher.favorite_subject}` : "Faculty"}
                      />
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const q = query.trim();
                  if (q) {
                    onClose();
                    router.push(`/student/search?q=${encodeURIComponent(q)}`);
                  }
                }}
                className="mx-auto flex rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-sealion"
              >
                View all results
              </button>
            </div>
          )}
        </div>
      </div>
      {viewing && <ProfileModal person={viewing} onClose={() => setViewing(null)} />}
    </>,
    document.body
  );
}
