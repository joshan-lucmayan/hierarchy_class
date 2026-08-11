"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useFriendsStore } from "@/lib/friendsStore";
import { useLeaderboard, rankFromAverage } from "@/lib/useLeaderboard";
import { useProgramByStudent } from "@/lib/useAcademicIdentity";
import { RankBadge } from "@/components/ui/RankBadge";
import type { ProfileRow } from "@/types/supabase";

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
      <SearchPageInner />
    </Suspense>
  );
}

function StudentCard({
  student,
  isFriend,
  onOpenProfile,
}: {
  student: ProfileRow;
  isFriend: boolean;
  onOpenProfile: (student: ProfileRow) => void;
}) {
  const { averageOf } = useLeaderboard();
  const programByStudent = useProgramByStudent();
  const rank = rankFromAverage(averageOf(student.id));

  return (
    <button
      type="button"
      onClick={() => onOpenProfile(student)}
      className="flex w-full items-center gap-4 py-4 text-left transition hover:opacity-80"
    >
      <img
        src={student.avatar_url || "/avatars/default-avatar.webp"}
        alt={student.full_name}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">{student.full_name}</p>
        <p className="text-xs text-muted">
          {[student.educational_level, student.level_label, programByStudent[student.id]]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <RankBadge rank={rank} size="sm" />
          {student.favorite_subject && <span className="text-xs text-muted">{student.favorite_subject}</span>}
        </div>
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold">
        {isFriend ? "Friend" : "View profile"}
      </span>
    </button>
  );
}

function StaffCard({
  person,
  roleLabel,
  onOpenProfile,
}: {
  person: ProfileRow;
  roleLabel: string;
  onOpenProfile: (person: ProfileRow) => void;
}) {
  return (
    <button type="button" onClick={() => onOpenProfile(person)} className="flex w-full items-center gap-3 py-4 text-left transition hover:opacity-80">
      <img
        src={person.avatar_url || "/avatars/default-avatar.webp"}
        alt={person.full_name}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">{person.full_name}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">{roleLabel}</p>
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold">View profile</span>
    </button>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileParam = searchParams.get("profile");
  const queryParam = searchParams.get("q");
  const [query, setQuery] = useState("");

  const { profiles: allStudents, loading: studentsLoading } = useSchoolProfiles({
    role: "student",
    excludeSelf: true,
  });
  const { profiles: allTeachers, loading: teachersLoading } = useSchoolProfiles({
    role: "teacher",
    excludeSelf: true,
  });
  // Admins are only fetched during an explicit search. Browsing the school
  // directory (empty query) shows students and faculty only, at the query
  // layer - the admin section never renders a full roster.
  const { profiles: allAdmins, loading: adminsLoading } = useSchoolProfiles({
    role: "admin",
    excludeSelf: true,
    enabled: !!query.trim(),
  });
  const { friendIds } = useFriendsStore();

  // ?q=<name> (from the home search bar's Enter key) pre-fills the query.
  useEffect(() => {
    if (queryParam) setQuery(queryParam);
  }, [queryParam]);

  // Old deep link: /student/search?profile=<id> now routes to the dedicated
  // profile page so the person's profile opens alone, not over the list.
  useEffect(() => {
    if (profileParam) {
      router.replace(`/student/profile/${profileParam}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileParam]);

  function openProfile(person: ProfileRow) {
    router.push(`/student/profile/${person.id}`);
  }

  const matches = (p: ProfileRow, normalized: string) =>
    p.full_name.toLowerCase().includes(normalized) ||
    (p.section ?? "").toLowerCase().includes(normalized) ||
    (p.level_label ?? "").toLowerCase().includes(normalized) ||
    (p.educational_level ?? "").toLowerCase().includes(normalized) ||
    (p.favorite_subject ?? "").toLowerCase().includes(normalized);

  const studentResults = useMemo(() => {
    if (!query.trim()) return allStudents;
    const normalized = query.toLowerCase();
    return allStudents.filter((s) => matches(s, normalized));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStudents, query]);

  const teacherResults = useMemo(() => {
    if (!query.trim()) return allTeachers;
    const normalized = query.toLowerCase();
    return allTeachers.filter((t) => matches(t, normalized));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTeachers, query]);

  const adminResults = useMemo(() => {
    if (!query.trim()) return allAdmins;
    const normalized = query.toLowerCase();
    return allAdmins.filter((a) => matches(a, normalized));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAdmins, query]);

  const loading = studentsLoading || teachersLoading || adminsLoading;
  const hasResults = studentResults.length > 0 || teacherResults.length > 0 || adminResults.length > 0;

  return (
    <div className="space-y-8">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
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
                  <StudentCard
                    key={student.id}
                    student={student}
                    isFriend={friendIds.includes(student.id)}
                    onOpenProfile={openProfile}
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
                  <StaffCard key={teacher.id} person={teacher} roleLabel="Faculty" onOpenProfile={openProfile} />
                ))}
              </div>
            </section>
          )}
          {adminResults.length > 0 && (
            <section className="space-y-1 border-t border-base pt-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Administrators</h2>
              <div className="divide-y divide-[var(--border)]">
                {adminResults.map((admin) => (
                  <StaffCard key={admin.id} person={admin} roleLabel="Admin" onOpenProfile={openProfile} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
