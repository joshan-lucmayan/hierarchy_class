"use client";

import { useMemo, useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useRankStore, type StudentRankInfo } from "@/lib/rankStore";
import { isNativeApp } from "@/lib/native";
import { useSchools } from "@/lib/useSchools";
import type { ProfileRow } from "@/types/supabase";

function FilterChips({
  label,
  options,
  active,
  onSelect,
  native,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  onSelect: (value: string) => void;
  native: boolean;
}) {
  const chipClass = native
    ? "shrink-0 whitespace-nowrap rounded-full border min-h-[44px] px-5 text-sm font-semibold transition"
    : "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition";
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{label}</p>
      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {options.map((o) => {
          const isActive = o.value === active;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onSelect(o.value)}
              aria-pressed={isActive}
              className={`${chipClass} ${
                isActive
                  ? "border-gold bg-gold text-on-accent"
                  : "border-base bg-[var(--surface-strong)] text-muted hover:border-gold-soft hover:text-gold-token"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { profile: myProfile } = useMyProfile();
  const { sections, courses, programs, students: enrollments } = useClassroomHierarchy();
  const { profiles: students, loading: studentsLoading } = useSchoolProfiles({ role: "student" });
  const { sorted, rankOf, loading: ranksLoading, error: ranksError } = useRankStore();
  const { schools } = useSchools();

  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");

  const native = isNativeApp();

  const schoolName = myProfile
    ? schools.find((s) => s.id === myProfile.school_id)?.name ?? null
    : null;

  const educationalLevels = useMemo(() => {
    return Array.from(
      new Set(students.map((s) => s.educational_level).filter((v): v is string => !!v))
    ).sort();
  }, [students]);

  interface Row {
    student: ProfileRow;
    rankInfo: StudentRankInfo | null;
  }

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

  const filtered = useMemo(() => {
    return entries.filter(({ student }) => {
      const courseIds = enrollments
        .filter((e) => e.profileId === student.id)
        .map((e) => e.courseId);
      const secIds = courses
        .filter((c) => courseIds.includes(c.id))
        .map((c) => c.sectionId);
      const progIds = sections
        .filter((s) => secIds.includes(s.id))
        .map((s) => s.programId);

      if (sectionFilter !== "all" && !secIds.includes(sectionFilter)) return false;
      if (programFilter !== "all" && !progIds.includes(programFilter)) return false;
      if (gradeFilter !== "all" && student.educational_level !== gradeFilter) return false;
      return true;
    });
  }, [entries, sectionFilter, programFilter, gradeFilter, enrollments, courses, sections]);

  const myPosition = myProfile ? entries.findIndex((e) => e.student.id === myProfile.id) + 1 : 0;
  const loading = studentsLoading || ranksLoading;

  const gridClass = native
    ? "grid gap-6"
    : "grid gap-6 lg:grid-cols-[1.3fr_0.9fr] xl:grid-cols-[1.4fr_0.8fr]";

  return (
    <div className={gridClass}>
      <section className="min-w-0 space-y-6">
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Leaderboard</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">School rankings</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
            Live, based on approved grades only
          </p>

          {(sections.length > 0 || courses.length > 0 || programs.length > 0) && (
            <div className="mt-5 space-y-4">
              <FilterChips
                label="Section"
                options={[
                  { value: "all", label: "All sections" },
                  ...sections.map((s) => ({ value: s.id, label: s.name })),
                ]}
                active={sectionFilter}
                onSelect={setSectionFilter}
                native={native}
              />

              {educationalLevels.length > 0 && (
                <FilterChips
                  label="Grade/Year"
                  options={[
                    { value: "all", label: "All grades" },
                    ...educationalLevels.map((v) => ({ value: v, label: v })),
                  ]}
                  active={gradeFilter}
                  onSelect={setGradeFilter}
                  native={native}
                />
              )}

              {programs.length > 0 && (
                <FilterChips
                  label="Program"
                  options={[
                    { value: "all", label: "All programs" },
                    ...programs.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  active={programFilter}
                  onSelect={setProgramFilter}
                  native={native}
                />
              )}

              {schoolName && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Campus</p>
                  <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full border border-gold bg-gold/10 text-navy ${
                        native ? "min-h-[44px] px-5 text-sm" : "px-4 py-1.5 text-xs"
                      } font-semibold`}
                    >
                      {schoolName}
                    </span>
                  </div>
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Leaderboard</p>
                <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full border border-base bg-[var(--surface-strong)] text-navy ${
                      native ? "min-h-[44px] px-5 text-sm" : "px-4 py-1.5 text-xs"
                    } font-semibold`}
                  >
                    School-wide · {entries.length} student{entries.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
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

      {!native && (
        <CornerFrame className="h-fit min-w-0 rounded-[10px] border border-base bg-surface p-5">
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
      )}
    </div>
  );
}