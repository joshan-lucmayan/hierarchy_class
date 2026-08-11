"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useFriendsStore } from "@/lib/friendsStore";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatRadarChart } from "@/components/profile/StatRadarChart";
import type { ProfileRow } from "@/types/supabase";

const COIN_PACKAGES = [
  { coins: 10, price: 49 },
  { coins: 50, price: 199 },
  { coins: 100, price: 349 },
];

function SendCharismaModal({ student, onClose }: { student: ProfileRow; onClose: () => void }) {
  const [selected, setSelected] = useState(COIN_PACKAGES[1].coins);
  const [sent, setSent] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
            <h2 className="mt-2 text-xl font-bold text-navy">Send charisma to {student.full_name.split(" ")[0]}</h2>
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
  student: ProfileRow;
  isFriend: boolean;
  onToggleFriend: (id: string) => void;
  onClose: () => void;
  onMessage: () => void;
  onSendCharisma: () => void;
}) {
  const { getStudentAverageByProfile, getStudentRankByProfile } = useClassroomHierarchy();
  const avg = getStudentAverageByProfile(student.id) ?? 0;
  const rank = getStudentRankByProfile(student.id) ?? "D";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Student profile</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>
        <div className="mt-3 flex flex-col items-center text-center">
          <img
            src={student.avatar_url || "/avatars/default-avatar.webp"}
            alt={student.full_name}
            className="h-20 w-20 rounded-full object-cover"
          />
          <h2 className="mt-3 text-2xl font-bold text-navy">{student.full_name}</h2>
          <p className="mt-1 text-sm text-muted">
            {[student.level_label, student.section].filter(Boolean).join(" · ")}
          </p>
          <RankBadge rank={rank} size="md" className="mt-3" />
        </div>
        {student.bio && <p className="mt-4 text-center text-sm leading-6 text-muted">{student.bio}</p>}
        {student.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
            {student.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
        {student.favorite_subject && (
          <p className="mt-5 text-center text-xs uppercase tracking-wide text-muted">
            Favorite subject · <span className="font-semibold text-navy">{student.favorite_subject}</span>
          </p>
        )}
        <div className="mt-4">
          <StatRadarChart stats={{ academic: avg, physical: 0, charisma: 0 }} />
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

function TeacherModal({ teacher, onClose, onMessage }: { teacher: ProfileRow; onClose: () => void; onMessage: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teacher profile</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>
        <div className="mt-3 flex flex-col items-center text-center">
          <img
            src={teacher.avatar_url || "/avatars/default-avatar.webp"}
            alt={teacher.full_name}
            className="h-20 w-20 rounded-full object-cover"
          />
          <h2 className="mt-3 text-2xl font-bold text-navy">{teacher.full_name}</h2>
          <p className="mt-1 text-sm text-muted">{teacher.favorite_subject ?? "No subject listed"}</p>
        </div>
        {teacher.bio && <p className="mt-4 text-center text-sm leading-6 text-muted">{teacher.bio}</p>}
        {teacher.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
            {teacher.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
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
  student: ProfileRow;
  isFriend: boolean;
  onToggleFriend: (id: string) => void;
  onOpenProfile: (student: ProfileRow) => void;
}) {
  const { getStudentAverageByProfile, getStudentRankByProfile } = useClassroomHierarchy();
  const rank = getStudentRankByProfile(student.id) ?? "D";

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <button type="button" onClick={() => onOpenProfile(student)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
        <img
          src={student.avatar_url || "/avatars/default-avatar.webp"}
          alt={student.full_name}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy">{student.full_name}</p>
          <p className="text-xs text-muted">{[student.level_label, student.section].filter(Boolean).join(" · ")}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RankBadge rank={rank} size="sm" />
            {student.favorite_subject && <span className="text-xs text-muted">{student.favorite_subject}</span>}
          </div>
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
  );
}

function TeacherCard({ teacher, onOpenProfile }: { teacher: ProfileRow; onOpenProfile: (teacher: ProfileRow) => void }) {
  return (
    <button type="button" onClick={() => onOpenProfile(teacher)} className="flex w-full items-center gap-3 py-4 text-left">
      <img
        src={teacher.avatar_url || "/avatars/default-avatar.webp"}
        alt={teacher.full_name}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy">{teacher.full_name}</p>
        <p className="text-xs text-muted">{teacher.favorite_subject ?? "No subject listed"}</p>
        <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-gold">Faculty</p>
      </div>
    </button>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openProfile, setOpenProfile] = useState<ProfileRow | null>(null);
  const [openTeacherProfile, setOpenTeacherProfile] = useState<ProfileRow | null>(null);
  const [charismaTarget, setCharismaTarget] = useState<ProfileRow | null>(null);

  const { profiles: allStudents, loading: studentsLoading } = useSchoolProfiles({ role: "student" });
  const { profiles: allTeachers, loading: teachersLoading } = useSchoolProfiles({ role: "teacher" });
  const { friendIds, addFriend, removeFriend } = useFriendsStore();

  function toggleFriend(id: string) {
    if (friendIds.includes(id)) {
      removeFriend(id);
    } else {
      addFriend(id);
    }
  }

  function messageStudent(student: ProfileRow) {
    setOpenProfile(null);
    router.push(`/student/messages?with=${student.id}`);
  }
  function messageTeacher(teacher: ProfileRow) {
    setOpenTeacherProfile(null);
    router.push(`/student/messages?with=${teacher.id}`);
  }

  const studentResults = useMemo(() => {
    if (!query.trim()) return allStudents;
    const normalized = query.toLowerCase();
    return allStudents.filter(
      (student) =>
        student.full_name.toLowerCase().includes(normalized) ||
        (student.section ?? "").toLowerCase().includes(normalized) ||
        (student.favorite_subject ?? "").toLowerCase().includes(normalized)
    );
  }, [allStudents, query]);

  const teacherResults = useMemo(() => {
    if (!query.trim()) return allTeachers;
    const normalized = query.toLowerCase();
    return allTeachers.filter(
      (teacher) =>
        teacher.full_name.toLowerCase().includes(normalized) ||
        (teacher.favorite_subject ?? "").toLowerCase().includes(normalized)
    );
  }, [allTeachers, query]);

  const loading = studentsLoading || teachersLoading;
  const hasResults = studentResults.length > 0 || teacherResults.length > 0;

  return (
    <div className="space-y-8">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="w-full max-w-md border-b border-base bg-transparent px-1 py-2 text-sm text-navy placeholder:text-muted outline-none focus:border-gold"
      />

      {loading ? (
        <p className="text-sm text-muted">Loading directory...</p>
      ) : !hasResults ? (
        <p className="text-sm text-muted">No matching profiles found.</p>
      ) : (
        <>
          {studentResults.length > 0 && (
            <section className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Students</h2>
              <div className="divide-y divide-[var(--border)]">
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
            <section className="space-y-1 border-t border-base pt-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Teachers</h2>
              <div className="divide-y divide-[var(--border)]">
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
        <TeacherModal teacher={openTeacherProfile} onClose={() => setOpenTeacherProfile(null)} onMessage={() => messageTeacher(openTeacherProfile)} />
      )}
      {charismaTarget && <SendCharismaModal student={charismaTarget} onClose={() => setCharismaTarget(null)} />}
    </div>
  );
}
