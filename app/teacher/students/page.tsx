"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { EnrolledBadge } from "@/components/ui/EnrolledBadge";
import type { ProfileRow } from "@/types/supabase";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RankBadge } from "@/components/ui/RankBadge";
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

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Student roster</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="mt-4 w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 text-sm text-navy outline-none focus:border-gold"
          />

          {studentsLoading && <p className="mt-6 text-sm text-muted">Loading roster...</p>}
          {studentsError && <p className="mt-6 text-sm text-red-500">{studentsError}</p>}
          {!studentsLoading && !studentsError && filteredStudents.length === 0 && (
            <p className="mt-6 text-sm text-muted">No students found yet.</p>
          )}

          <div className="mt-6 max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {filteredStudents.map((student) => {
              const identity = identityByStudent[student.id];
              return (
                <button
                  type="button"
                  key={student.id}
                  onClick={() => setSelectedId(student.id)}
                  className={`w-full rounded-[10px] border px-4 py-4 text-left transition ${
                    selectedStudent?.id === student.id
                      ? "border-sealion bg-[var(--surface-strong)]"
                      : "border-base bg-surface hover:border-sealion"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar name={student.full_name} src={student.avatar_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-navy">{student.full_name}</p>
                        <RankBadge rank={rankOf(student.id)?.current_rank ?? "D"} size="sm" />
                        {!enrollLoading && <EnrolledBadge status={effectiveOf(student.id)} size="sm" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[student.educational_level, student.program ?? identity?.programs.join(" · "), student.level_label]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CornerFrame>

        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Selected student</p>
          {!selectedStudent ? (
            <p className="mt-4 text-sm text-muted">Select a student from the roster to see details.</p>
          ) : (
            <div className="mt-4 rounded-[10px] border border-base bg-[var(--surface-strong)] p-6">
              <div className="flex items-center gap-4">
                <UserAvatar name={selectedStudent.full_name} src={selectedStudent.avatar_url} size="xl" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-navy">{selectedStudent.full_name}</p>
                    {!enrollLoading && <EnrolledBadge status={effectiveOf(selectedStudent.id)} size="sm" />}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    <p>
                      {[selectedStudent.educational_level, selectedStudent.program ?? selectedIdentity?.programs.join(" · "), selectedStudent.level_label]
                        .filter(Boolean)
                        .join(" · ") || "No level set"}
                    </p>
                  </div>

                </div>
              </div>
              <div className="mt-5 space-y-4 text-sm text-muted">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Rank progress</p>
                  <div className="mt-2">
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
                <p><span className="font-semibold text-navy">Favorite subject:</span> {selectedStudent.favorite_subject ?? "Not set"}</p>
                <p><span className="font-semibold text-navy">Tags:</span> {selectedStudent.tags.length > 0 ? selectedStudent.tags.join(", ") : "None yet"}</p>
              </div>
            </div>
          )}
        </CornerFrame>
      </section>
    </div>
  );
}
