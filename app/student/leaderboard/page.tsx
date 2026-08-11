"use client";

import { useMemo, useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useLeaderboard, rankFromAverage } from "@/lib/useLeaderboard";

export default function LeaderboardPage() {
  const { profile: myProfile } = useMyProfile();
  const { sections, courses, students: enrollments } = useClassroomHierarchy();
  const { entries: ranked, loading, error, positionOf } = useLeaderboard();

  const [sectionFilter, setSectionFilter] = useState<string>("all");

  // A student "belongs" to whatever section(s) their enrolled courses sit under.
  const filtered = useMemo(() => {
    if (sectionFilter === "all") return ranked;
    return ranked.filter(({ studentId }) => {
      const courseIds = enrollments.filter((e) => e.profileId === studentId).map((e) => e.courseId);
      const secIds = courses.filter((c) => courseIds.includes(c.id)).map((c) => c.sectionId);
      return secIds.includes(sectionFilter);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, sectionFilter, enrollments, courses]);

  const myPosition = myProfile ? positionOf(myProfile.id) : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <section className="space-y-6">
        <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
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
                className="rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-navy outline-none"
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
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && !error && ranked.length === 0 && (
            <p className="text-sm text-muted">No ranked students yet.</p>
          )}
          {!loading && !error && ranked.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted">No students match this filter yet.</p>
          )}
          {filtered.map((entry, idx) => (
            <LeaderboardRow
              key={entry.studentId}
              rank={idx + 1}
              student={{
                id: entry.studentId,
                name: entry.fullName,
                avatarUrl: entry.avatarUrl,
                program: entry.programName ?? "",
                levelLabel: entry.levelLabel ?? "",
                educationalLevel: entry.educationalLevel ?? "",
                score: entry.academicExcellence,
                overallRank: rankFromAverage(entry.academicExcellence),
              }}
              isCurrentUser={myProfile?.id === entry.studentId}
            />
          ))}
        </div>
      </section>

      <CornerFrame className="h-fit rounded-3xl border border-base bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy">Rank quick view</p>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>
            Live standings based on approved grade submissions. Only aggregate averages are shown - individual
            grades stay private to each student and their teachers.
          </p>
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
