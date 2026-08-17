"use client";

import { useMemo, useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useRankStore, type StudentRankInfo } from "@/lib/rankStore";
import type { ProfileRow } from "@/types/supabase";

export default function LeaderboardPage() {
  const { profile: myProfile } = useMyProfile();
  const { sections, courses, students: enrollments } = useClassroomHierarchy();
  const { profiles: students, loading: studentsLoading } = useSchoolProfiles({ role: "student" });
  const { sorted, rankOf, loading: ranksLoading, error: ranksError } = useRankStore();

  const [sectionFilter, setSectionFilter] = useState<string>("all");

  interface Row {
    student: ProfileRow;
    rankInfo: StudentRankInfo | null;
  }

  // Ranked students first (best rank, then bar/ex score), unranked students
  // (no score entries yet) after, sorted by name.
  const entries: Row[] = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]));
    const rankedRows: Row[] = sorted
      .filter((r) => byId.has(r.student_id))
      .map((r) => ({ student: byId.get(r.student_id)!, rankInfo: r }));
    const unrankedRows: Row[] = students
      .filter((s) => !rankOf(s.id))
      .map((s) => ({ student: s, rankInfo: null }))
      .sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));
    return [...rankedRows, ...unrankedRows];
  }, [students, sorted, rankOf]);

  // A student "belongs" to whatever section(s) their enrolled courses sit under.
  const filtered = useMemo(() => {
    if (sectionFilter === "all") return entries;
    return entries.filter(({ student }) => {
      const courseIds = enrollments.filter((e) => e.profileId === student.id).map((e) => e.courseId);
      const secIds = courses.filter((c) => courseIds.includes(c.id)).map((c) => c.sectionId);
      return secIds.includes(sectionFilter);
    });
  }, [entries, sectionFilter, enrollments, courses]);

  const myPosition = myProfile ? entries.findIndex((e) => e.student.id === myProfile.id) + 1 : 0;
  const loading = studentsLoading || ranksLoading;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <section className="space-y-6">
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Leaderboard</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">School rankings</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
            Live, based on approved grades only
          </p>

          {(sections.length > 0 || courses.length > 0) && (
            <div className="mt-5 flex flex-wrap gap-3">
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="rounded-[10px] border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy outline-none"
              >
                <option value="all">All sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </CornerFrame>

        <div className="space-y-3">
          {loading && <p className="text-sm text-muted">Loading rankings...</p>}
          {ranksError && <p className="text-sm text-warn">{ranksError}</p>}
          {!loading && !ranksError && entries.length === 0 && (
            <p className="text-sm text-muted">No ranked students yet.</p>
          )}
          {!loading && !ranksError && entries.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted">No students match this filter yet.</p>
          )}
          {filtered.map(({ student, rankInfo }, idx) => (
            <LeaderboardRow
              key={student.id}
              rank={idx + 1}
              student={{
                id: student.id,
                name: student.full_name,
                avatarUrl: student.avatar_url,
                program: student.program ?? "",
                levelLabel: student.level_label ?? "",
                educationalLevel: student.educational_level ?? "",
                rank: rankInfo?.current_rank ?? null,
              }}
              isCurrentUser={myProfile?.id === student.id}
            />
          ))}
        </div>
      </section>

      <CornerFrame className="h-fit rounded-[10px] border border-base bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy">Rank quick view</p>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>
            Live standings from the rank engine. Category percentages combine into a composite
            score, the power curve maps it to the rank bar, and EX is the open-ended top tier.
          </p>
          <div className="rounded-[10px] border border-gold bg-[var(--surface-strong)] p-4">
            <p className="text-xs uppercase tracking-wide text-muted">You are</p>
            <p className="mt-2 text-2xl font-bold text-navy">
              {myPosition > 0 ? `Rank ${myPosition} of ${entries.length}` : "Not ranked yet"}
            </p>
          </div>
        </div>
      </CornerFrame>
    </div>
  );
}
