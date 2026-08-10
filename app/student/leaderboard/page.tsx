"use client";

import { useMemo, useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

export default function LeaderboardPage() {
  const { profile: myProfile } = useMyProfile();
  const { profiles: students, loading: studentsLoading, error: studentsError } = useSchoolProfiles({ role: "student" });
  const {
    programs,
    sections,
    courses,
    students: enrollments,
    getStudentAverageByProfile,
    getStudentRankByProfile,
  } = useClassroomHierarchy();

  const [programFilter, setProgramFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  // A student "belongs" to whatever section(s) their enrolled courses sit under.
  function sectionIdsFor(profileId: string): string[] {
    const courseIds = enrollments.filter((e) => e.profileId === profileId).map((e) => e.courseId);
    const secIds = courses.filter((c) => courseIds.includes(c.id)).map((c) => c.sectionId);
    return Array.from(new Set(secIds));
  }

  const sectionsForProgramFilter = programFilter === "all" ? sections : sections.filter((s) => s.programId === programFilter);

  const ranked = useMemo(() => {
    const withScores = students.map((s) => ({
      profile: s,
      avg: getStudentAverageByProfile(s.id) ?? 0,
      rank: getStudentRankByProfile(s.id) ?? "D",
    }));
    return withScores.sort((a, b) => b.avg - a.avg);
  }, [students, getStudentAverageByProfile, getStudentRankByProfile]);

  const filtered = useMemo(() => {
    if (programFilter === "all" && sectionFilter === "all") return ranked;
    return ranked.filter(({ profile }) => {
      const mySectionIds = sectionIdsFor(profile.id);
      if (sectionFilter !== "all") return mySectionIds.includes(sectionFilter);
      const programSectionIds = sections.filter((s) => s.programId === programFilter).map((s) => s.id);
      return mySectionIds.some((id) => programSectionIds.includes(id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, programFilter, sectionFilter, enrollments, courses, sections]);

  const myPosition = myProfile ? ranked.findIndex((r) => r.profile.id === myProfile.id) + 1 : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <section className="space-y-6">
        <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Leaderboard</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">School rankings</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
            Live, based on every grade submitted so far
          </p>

          {(programs.length > 0 || sections.length > 0) && (
            <div className="mt-5 flex flex-wrap gap-3">
              <select
                value={programFilter}
                onChange={(e) => { setProgramFilter(e.target.value); setSectionFilter("all"); }}
                className="rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy outline-none"
              >
                <option value="all">All programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy outline-none"
              >
                <option value="all">All sections</option>
                {sectionsForProgramFilter.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </CornerFrame>

        <div className="space-y-3">
          {studentsLoading && <p className="text-sm text-muted">Loading students...</p>}
          {studentsError && <p className="text-sm text-muted">{studentsError}</p>}
          {!studentsLoading && !studentsError && filtered.length === 0 && (
            <p className="text-sm text-muted">No students match this filter yet.</p>
          )}
          {filtered.map((entry, idx) => (
            <LeaderboardRow
              key={entry.profile.id}
              rank={idx + 1}
              student={{
                id: entry.profile.id,
                name: entry.profile.full_name,
                avatarUrl: entry.profile.avatar_url,
                levelLabel: entry.profile.level_label ?? "",
                section: entry.profile.section ?? "",
                overallRank: entry.rank as any,
              }}
              isCurrentUser={myProfile?.id === entry.profile.id}
            />
          ))}
        </div>
      </section>

      <CornerFrame className="h-fit rounded-3xl border border-base bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy">Rank quick view</p>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>Live standings, ranked by academic excellence computed from real grade submissions.</p>
          <div className="rounded-2xl border border-gold bg-[var(--surface-strong)] p-4">
            <p className="text-xs uppercase tracking-wide text-muted">You are</p>
            <p className="mt-2 text-2xl font-bold text-navy">
              {myPosition > 0 ? `Rank ${myPosition} of ${ranked.length}` : "Not ranked yet"}
            </p>
          </div>
        </div>
      </CornerFrame>
    </div>
  );
}
