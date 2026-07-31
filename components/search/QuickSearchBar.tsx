"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STUDENT_DIRECTORY, TEACHER_DIRECTORY } from "@/data/mockStudents";
import { StudentDirectoryEntry } from "@/types/student";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatRadarChart } from "@/components/profile/StatRadarChart";

type TeacherEntry = (typeof TEACHER_DIRECTORY)[number];

const COIN_PACKAGES = [
  { coins: 10, price: 49 },
  { coins: 50, price: 199 },
  { coins: 100, price: 349 },
];

const RESULT_LIMIT = 5;

function SendCharismaModal({ student, onClose }: { student: StudentDirectoryEntry; onClose: () => void }) {
  const [selected, setSelected] = useState(COIN_PACKAGES[1].coins);
  const [sent, setSent] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <p className="text-3xl">✨</p>
            <p className="mt-3 text-lg font-bold text-navy">Sent!</p>
            <p className="mt-2 text-sm text-muted">
              This is a UI preview only - Coin Charisma purchases aren&apos;t connected to real payments yet.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Coin Charisma</p>
            <h2 className="mt-2 text-xl font-bold text-navy">Send charisma to {student.name.split(" ")[0]}</h2>
            <p className="mt-2 text-sm text-muted">Choose a coin package to boost their charisma stat.</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {COIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.coins}
                  type="button"
                  onClick={() => setSelected(pkg.coins)}
                  className={`rounded-2xl border px-2 py-3 text-center transition ${
                    selected === pkg.coins ? "border-gold bg-[var(--surface-strong)]" : "border-base bg-surface hover:border-gold"
                  }`}
                >
                  <p className="text-lg font-bold text-navy">{pkg.coins}</p>
                  <p className="text-[11px] text-muted">coins</p>
                  <p className="mt-1 text-xs font-semibold text-gold">₱{pkg.price}</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSent(true)}
              className="mt-5 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-navy transition hover:opacity-90"
            >
              Send {selected} coins
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-full border border-base py-2.5 text-sm font-semibold text-navy transition hover:border-gold"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProfileModal({
  student,
  isFriend,
  onToggleFriend,
  onClose,
  onMessage,
  onSendCharisma,
}: {
  student: StudentDirectoryEntry;
  isFriend: boolean;
  onToggleFriend: (id: string) => void;
  onClose: () => void;
  onMessage: () => void;
  onSendCharisma: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Student profile</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>

        <div className="mt-3 flex flex-col items-center text-center">
          <img src="/avatars/default-avatar.webp" alt={student.name} className="h-20 w-20 rounded-full object-cover" />
          <h2 className="mt-3 text-2xl font-bold text-navy">{student.name}</h2>
          <p className="mt-1 text-sm text-muted">Grade {student.gradeLevel} · {student.section}</p>
          <RankBadge rank={student.overallRank} size="md" className="mt-3" />
        </div>

        <p className="mt-4 text-center text-sm leading-6 text-muted">{student.bio}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
          {student.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <p className="mt-5 text-center text-xs uppercase tracking-wide text-muted">
          Favorite subject · <span className="font-semibold text-navy">{student.favoriteSubject}</span>
        </p>

        <div className="mt-4">
          <StatRadarChart stats={student.stats} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onToggleFriend(student.id)}
            className={`rounded-full px-3 py-2.5 text-xs font-semibold transition ${
              isFriend
                ? "border border-base bg-surface text-muted hover:border-red-400 hover:text-red-600"
                : "bg-gold text-navy hover:opacity-90"
            }`}
          >
            {isFriend ? "Friends" : "Add Friend"}
          </button>
          <button
            type="button"
            onClick={onMessage}
            className="rounded-full border border-base bg-surface px-3 py-2.5 text-xs font-semibold text-navy transition hover:border-gold"
          >
            Message
          </button>
          <button
            type="button"
            onClick={onSendCharisma}
            className="rounded-full bg-navy px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-gold hover:text-navy"
          >
            Send Charisma
          </button>
        </div>
      </div>
    </div>
  );
}

function TeacherModal({
  teacher,
  onClose,
  onMessage,
}: {
  teacher: TeacherEntry;
  onClose: () => void;
  onMessage: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher profile</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>

        <div className="mt-3 flex flex-col items-center text-center">
          <img src="/avatars/default-avatar.webp" alt={teacher.name} className="h-20 w-20 rounded-full object-cover" />
          <h2 className="mt-3 text-2xl font-bold text-navy">{teacher.name}</h2>
          <p className="mt-1 text-sm text-muted">{teacher.subject} Teacher · {teacher.office}</p>
        </div>

        <p className="mt-4 text-center text-sm leading-6 text-muted">{teacher.bio}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
          {teacher.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <button
          type="button"
          onClick={onMessage}
          className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
        >
          Message
        </button>
      </div>
    </div>
  );
}

export function QuickSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>(["s-010", "s-014", "s-022", "s-042"]);
  const [openProfile, setOpenProfile] = useState<StudentDirectoryEntry | null>(null);
  const [openTeacherProfile, setOpenTeacherProfile] = useState<TeacherEntry | null>(null);
  const [charismaTarget, setCharismaTarget] = useState<StudentDirectoryEntry | null>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleFriend(id: string) {
    setFriendIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  function messageStudent(student: StudentDirectoryEntry) {
    setOpenProfile(null);
    router.push(`/student/messages?with=${student.id}`);
  }

  function messageTeacher(teacher: TeacherEntry) {
    setOpenTeacherProfile(null);
    router.push(`/student/messages?with=${teacher.id}`);
  }

  const studentResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalized = query.toLowerCase();
    return STUDENT_DIRECTORY.filter(
      (student) =>
        student.name.toLowerCase().includes(normalized) ||
        student.section.toLowerCase().includes(normalized) ||
        student.favoriteSubject.toLowerCase().includes(normalized)
    ).slice(0, RESULT_LIMIT);
  }, [query]);

  const teacherResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalized = query.toLowerCase();
    return TEACHER_DIRECTORY.filter(
      (teacher) =>
        teacher.name.toLowerCase().includes(normalized) ||
        teacher.subject.toLowerCase().includes(normalized) ||
        teacher.office.toLowerCase().includes(normalized)
    ).slice(0, RESULT_LIMIT);
  }, [query]);

  const showDropdown = focused && query.trim().length > 0;
  const hasResults = studentResults.length > 0 || teacherResults.length > 0;

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setFocused(true);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setFocused(false), 150);
  }

  function openStudent(student: StudentDirectoryEntry) {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpenProfile(student);
    setFocused(false);
  }

  function openTeacher(teacher: TeacherEntry) {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpenTeacherProfile(teacher);
    setFocused(false);
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
          placeholder="Search Hierarchy Class"
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
                  onClick={() => openStudent(student)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <img src="/avatars/default-avatar.webp" alt={student.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{student.name}</p>
                    <p className="truncate text-xs text-muted">Grade {student.gradeLevel} · {student.section}</p>
                  </div>
                </button>
              ))}
              {teacherResults.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => openTeacher(teacher)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <img src="/avatars/default-avatar.webp" alt={teacher.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{teacher.name}</p>
                    <p className="truncate text-xs text-gold">{teacher.subject} Teacher</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {openProfile && (
        <ProfileModal
          student={openProfile}
          isFriend={friendIds.includes(openProfile.id)}
          onToggleFriend={toggleFriend}
          onClose={() => setOpenProfile(null)}
          onMessage={() => messageStudent(openProfile)}
          onSendCharisma={() => setCharismaTarget(openProfile)}
        />
      )}

      {openTeacherProfile && (
        <TeacherModal
          teacher={openTeacherProfile}
          onClose={() => setOpenTeacherProfile(null)}
          onMessage={() => messageTeacher(openTeacherProfile)}
        />
      )}

      {charismaTarget && (
        <SendCharismaModal student={charismaTarget} onClose={() => setCharismaTarget(null)} />
      )}
    </div>
  );
}
