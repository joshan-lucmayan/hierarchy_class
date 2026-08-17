"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { EnrolledBadge } from "@/components/ui/EnrolledBadge";
import type { ProfileRow } from "@/types/supabase";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RankBadge } from "@/components/ui/RankBadge";
import { IconUser } from "@/components/ui/icons";
import { useRankStore } from "@/lib/rankStore";

export default function TeacherStudentsPage() {
  const { profiles: students, loading: studentsLoading, error: studentsError } = useSchoolProfiles({ role: "student" });
  const { getStudentAverageByProfile, sections, courses, programs, students: enrollments } =
    useClassroomHierarchy();
  const { rankOf } = useRankStore();
  const { statuses: enrollmentStatuses, loading: enrollLoading } = useSchoolEnrollments();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Program -> Grade/Year -> Section per student, derived from real enrollments.
  const identityByStudent = useMemo(() => {
    const map: Record<string, { programs: string[]; sections: string[] }> = {};
    enrollments.forEach((e) => {
      if (!e.profileId) return;
      const course = courses.find((c) => c.id === e.courseId);
      const section = course ? sections.find((s) => s.id === course.sectionId) : undefined;
      const program = section ? programs.find((p) => p.id === section.programId) : undefined;
      if (!map[e.profileId]) map[e.profileId] = { programs: [], sections: [] };
      if (program && !map[e.profileId].programs.includes(program.name)) {
        map[e.profileId].programs.push(program.name);
      }
      if (section && !map[e.profileId].sections.includes(section.name)) {
        map[e.profileId].sections.push(section.name);
      }
    });
    return map;
  }, [enrollments, courses, sections, programs]);

  const effectiveOf = (studentId: string) => {
    const info = enrollmentStatuses[studentId];
    if (!info) return "unknown" as const;
    return effectiveFrom({
      student_id: info.studentId,
      school_id: "",
      status: info.status as "enrolled" | "revoked",
      started_at: info.startedAt ?? "",
      expires_at: info.expiresAt,
      updated_by: null,
      created_at: "",
      updated_at: "",
    } as any);
  };

  const filteredStudents = useMemo(() => {
    const normalized = query.toLowerCase();
    return students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(normalized) ||
        (student.program ?? "").toLowerCase().includes(normalized) ||
        (student.level_label ?? "").toLowerCase().includes(normalized) ||
        (student.educational_level ?? "").toLowerCase().includes(normalized)
    );
  }, [students, query]);

  const selectedStudent: ProfileRow | undefined =
    filteredStudents.find((s) => s.id === selectedId) ?? filteredStudents[0];

  const selectedIdentity = selectedStudent ? identityByStudent[selectedStudent.id] : undefined;

  // Roster-wide average across approved grades (same real computation the
  // detail panel uses per student).
  const overallAvg = useMemo(() => {
    const avgs = students.map((s) => getStudentAverageByProfile(s.id)).filter((v): v is number => v !== null);
    if (avgs.length === 0) return null;
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
  }, [students, getStudentAverageByProfile]);

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">My students</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Student roster · {students.length} at school
          </h2>
        </div>
        <Stat
          label="Roster average"
          value={studentsLoading ? "—" : overallAvg !== null ? `${overallAvg} / 100` : "No grades yet"}
          tone="gold"
          hint="Weighted across all students"
        />
      </div>

      {/* ============================================================ */}
      {/* BAND 1 - ROSTER + DETAIL                                    */}
      {/* ============================================================ */}
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {/* Roster */}
        <CornerFrame className="p-5">
          <h2 className="section-label">Student roster</h2>
          <div className="relative mt-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students..."
              className="w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 pr-16 text-sm text-navy outline-none focus:border-gold"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
              {filteredStudents.length}
            </span>
          </div>

          {studentsError && (
            <p className="mt-4 rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
              {studentsError}
            </p>
          )}

          {studentsLoading ? (
            /* Skeleton: mirror the real roster-row geometry. */
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 rounded-[10px] border border-base p-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-tile" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded-full bg-tile" />
                    <div className="h-2.5 w-28 rounded-full bg-tile" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-tile" />
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={<IconUser size={16} />}
                title="No students yet"
                desc="Students appear here as soon as they sign up and are verified in your school."
              />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={<IconUser size={16} />}
                title="No students found"
                desc="No students match the current search."
              />
              {query && (
                <div className="mt-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
              {filteredStudents.map((student) => {
                const identity = identityByStudent[student.id];
                return (
                  <button
                    type="button"
                    key={student.id}
                    onClick={() => setSelectedId(student.id)}
                    className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-3 text-left transition ${
                      selectedStudent?.id === student.id
                        ? "border-gold-token bg-[var(--surface-strong)]"
                        : "border-base bg-surface hover:border-gold-soft"
                    }`}
                  >
                    <UserAvatar name={student.full_name} src={student.avatar_url} size="md" profileId={student.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-navy">{student.full_name}</p>
                        <RankBadge rank={rankOf(student.id)?.current_rank ?? "D"} size="sm" />
                        {!enrollLoading && <EnrolledBadge status={effectiveOf(student.id)} size="sm" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[student.educational_level, student.program ?? identity?.programs.join(" · "), student.level_label]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CornerFrame>

        {/* Selected student */}
        <CornerFrame className="p-5">
          <h2 className="section-label">Selected student</h2>
          {!selectedStudent ? (
            <div className="py-10">
              <EmptyState
                icon={<IconUser size={16} />}
                title="Select a student"
                desc="Pick a student from the roster to view their rank, enrollment, and academic details."
              />
            </div>
          ) : (
            <>
              {/* Identity */}
              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[10px] border border-base bg-[var(--surface-strong)] p-5">
                <UserAvatar
                  name={selectedStudent.full_name}
                  src={selectedStudent.avatar_url}
                  size="xl"
                  profileId={selectedStudent.id}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-navy">{selectedStudent.full_name}</p>
                    {!enrollLoading && <EnrolledBadge status={effectiveOf(selectedStudent.id)} size="sm" />}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[selectedStudent.educational_level, selectedStudent.program ?? selectedIdentity?.programs.join(" · "), selectedStudent.level_label]
                      .filter(Boolean)
                      .join(" · ") || "No level set"}
                  </p>
                </div>
              </div>

              {/* Stat strip */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat
                  label="Average"
                  value={getStudentAverageByProfile(selectedStudent.id) ?? "—"}
                  tone={getStudentAverageByProfile(selectedStudent.id) !== null ? "gold" : "muted"}
                  hint="Across approved grades"
                />
                <Stat
                  label="Tags"
                  value={selectedStudent.tags.length}
                  hint={selectedStudent.favorite_subject ? `Favorite: ${selectedStudent.favorite_subject}` : "No favorite set"}
                />
              </div>

              {/* Rank progress */}
              <div className="mt-4 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
                <h3 className="section-label">Rank progress</h3>
                <div className="mt-3">
                  <RankBadge
                    rank={rankOf(selectedStudent.id)?.current_rank ?? "D"}
                    size="md"
                    bar={(() => {
                      const r = rankOf(selectedStudent.id);
                      return r && r.current_rank !== "EX" ? r.current_bar : null;
                    })()}
                    exScore={rankOf(selectedStudent.id)?.current_rank === "EX" ? rankOf(selectedStudent.id)?.ex_score : null}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {getStudentAverageByProfile(selectedStudent.id) !== null
                    ? `Average ${getStudentAverageByProfile(selectedStudent.id)} / 100 across approved grades`
                    : "No approved grades yet"}
                </p>
              </div>

              {/* Student details */}
              <div className="mt-4 space-y-1.5 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
                <h3 className="section-label">Student details</h3>
                <p className="mt-2 text-sm text-muted">
                  <span className="font-semibold text-navy">Favorite subject:</span>{" "}
                  {selectedStudent.favorite_subject ?? "Not set"}
                </p>
                <p className="text-sm text-muted">
                  <span className="font-semibold text-navy">Tags:</span>{" "}
                  {selectedStudent.tags.length > 0 ? selectedStudent.tags.join(", ") : "None yet"}
                </p>
              </div>
            </>
          )}
        </CornerFrame>
      </section>
    </div>
  );
}
