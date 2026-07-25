"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STUDENT_DIRECTORY, TEACHER_DIRECTORY } from "@/data/mockStudents";
import { StudentDirectoryEntry } from "@/types/student";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatRadarChart } from "@/components/profile/StatRadarChart";

type TeacherEntry = (typeof TEACHER_DIRECTORY)[number];

const COIN_PACKAGES = [
  { coins: 10, price: 49 },
  { coins: 50, price: 199 },
  { coins: 100, price: 349 },
];

function SendCharismaModal({ student, onClose }: { student: StudentDirectoryEntry; onClose: () => void }) {
  const [selected, setSelected] = useState(COIN_PACKAGES[1].coins);
  const [sent, setSent] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border-2 border-gold bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <p className="text-3xl">✨</p>
            <p className="mt-3 text-lg font-bold text-navy">Sent!</p>
            <p className="mt-2 text-sm text-muted">
              This is a UI preview only — Coin Charisma purchases aren&apos;t connected to real payments yet.
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-gold bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Student profile</p>
          <button type="button" onClick={onClose} className="text-muted">✕</button>
        </div>

        <div className="mt-3 flex flex-col items-center text-center">
          <img src="/avatars/default-avatar.webp" alt={student.name} className="h-20 w-20 rounded-full border-2 border-gold object-cover" />
          <h2 className="mt-3 text-2xl font-bold text-navy">{student.name}</h2>
          <p className="mt-1 text-sm text-muted">Grade {student.gradeLevel} · {student.section}</p>
          <RankBadge rank={student.overallRank} size="md" className="mt-3" />
        </div>

        <p className="mt-4 text-center text-sm leading-6 text-muted">{student.bio}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {student.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-base px-3 py-1 text-[11px] font-medium text-navy">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
          <p className="text-center text-xs uppercase tracking-wide text-muted">Favorite subject</p>
          <p className="mt-1 text-center text-sm font-semibold text-navy">{student.favoriteSubject}</p>
        </div>

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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-gold bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher profile</p>
          <button type="button" onClick={onClose} className="text-muted">✕</button>
        </div>

        <div className="mt-3 flex flex-col items-center text-center">
          <img src="/avatars/default-avatar.webp" alt={teacher.name} className="h-20 w-20 rounded-full border-2 border-gold object-cover" />
          <h2 className="mt-3 text-2xl font-bold text-navy">{teacher.name}</h2>
          <p className="mt-1 text-sm text-muted">{teacher.subject} Teacher · {teacher.office}</p>
        </div>

        <p className="mt-4 text-center text-sm leading-6 text-muted">{teacher.bio}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {teacher.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-base px-3 py-1 text-[11px] font-medium text-navy">
              {tag}
            </span>
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

function ProfileCard({
  student,
  isFriend,
  onToggleFriend,
  onOpenProfile,
}: {
  student: StudentDirectoryEntry;
  isFriend: boolean;
  onToggleFriend: (id: string) => void;
  onOpenProfile: (student: StudentDirectoryEntry) => void;
}) {
  return (
    <CornerFrame className="rounded-3xl border border-base bg-surface p-4 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpenProfile(student)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <img src="/avatars/default-avatar.webp" alt={student.name} className="h-12 w-12 rounded-full border-2 border-gold object-cover" />
          <div>
            <p className="text-sm font-semibold text-navy">{student.name}</p>
            <p className="text-xs text-muted">Grade {student.gradeLevel} · {student.section}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onToggleFriend(student.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            isFriend
              ? "border border-base bg-surface text-muted hover:border-red-400 hover:text-red-600"
              : "bg-gold text-navy hover:opacity-90"
          }`}
        >
          {isFriend ? "Friends" : "Add Friend"}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RankBadge rank={student.overallRank} size="sm" />
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-muted">{student.favoriteSubject}</span>
      </div>
      <div className="mt-4 text-sm text-muted">
        <p className="font-semibold text-muted">Tags</p>
        <p>{student.tags.join(", ")}</p>
      </div>
    </CornerFrame>
  );
}

function TeacherCard({
  teacher,
  onOpenProfile,
}: {
  teacher: TeacherEntry;
  onOpenProfile: (teacher: TeacherEntry) => void;
}) {
  return (
    <CornerFrame className="rounded-3xl border border-base bg-surface p-4 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
      <button type="button" onClick={() => onOpenProfile(teacher)} className="flex w-full items-center gap-3 text-left">
        <img src="/avatars/default-avatar.webp" alt={teacher.name} className="h-12 w-12 rounded-full border-2 border-gold object-cover" />
        <div>
          <p className="text-sm font-semibold text-navy">{teacher.name}</p>
          <p className="text-xs text-muted">{teacher.subject} Teacher · {teacher.office}</p>
        </div>
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gold bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-navy">Faculty</span>
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-muted">{teacher.subject}</span>
      </div>
      <div className="mt-4 text-sm text-muted">
        <p className="font-semibold text-muted">Tags</p>
        <p>{teacher.tags.join(", ")}</p>
      </div>
    </CornerFrame>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [friendIds, setFriendIds] = useState<string[]>(["s-010", "s-014", "s-022", "s-042"]);
  const [openProfile, setOpenProfile] = useState<StudentDirectoryEntry | null>(null);
  const [openTeacherProfile, setOpenTeacherProfile] = useState<TeacherEntry | null>(null);
  const [charismaTarget, setCharismaTarget] = useState<StudentDirectoryEntry | null>(null);

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
    const normalized = query.toLowerCase();
    return STUDENT_DIRECTORY.filter((student) =>
      student.name.toLowerCase().includes(normalized) ||
      student.section.toLowerCase().includes(normalized) ||
      student.favoriteSubject.toLowerCase().includes(normalized)
    );
  }, [query]);

  const teacherResults = useMemo(() => {
    const normalized = query.toLowerCase();
    return TEACHER_DIRECTORY.filter((teacher) =>
      teacher.name.toLowerCase().includes(normalized) ||
      teacher.subject.toLowerCase().includes(normalized) ||
      teacher.office.toLowerCase().includes(normalized)
    );
  }, [query]);

  const hasResults = studentResults.length > 0 || teacherResults.length > 0;

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Search</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Find classmates and teachers</h1>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search profile"
            className="w-full max-w-md rounded-3xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm text-navy placeholder:text-muted outline-none"
          />
        </div>
      </CornerFrame>

      {!hasResults ? (
        <div className="rounded-3xl border border-base bg-surface p-6 text-muted shadow-card">
          No matching profiles found.
        </div>
      ) : (
        <>
          {studentResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Students</h2>
              <div className="grid gap-4 xl:grid-cols-2">
                {studentResults.map((student) => (
                  <ProfileCard
                    key={student.id}
                    student={student}
                    isFriend={friendIds.includes(student.id)}
                    onToggleFriend={toggleFriend}
                    onOpenProfile={setOpenProfile}
                  />
                ))}
              </div>
            </section>
          )}

          {teacherResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Teachers</h2>
              <div className="grid gap-4 xl:grid-cols-2">
                {teacherResults.map((teacher) => (
                  <TeacherCard key={teacher.id} teacher={teacher} onOpenProfile={setOpenTeacherProfile} />
                ))}
              </div>
            </section>
          )}
        </>
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
