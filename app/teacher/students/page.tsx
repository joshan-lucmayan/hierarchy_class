"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import type { ProfileRow } from "@/types/supabase";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { RankBadge } from "@/components/ui/RankBadge";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

export default function TeacherStudentsPage() {
  const { profiles: students, loading: studentsLoading, error: studentsError } = useSchoolProfiles({ role: "student" });
  const { getStudentAverageByProfile, getStudentRankByProfile } = useClassroomHierarchy();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    const normalized = query.toLowerCase();
    return students.filter(
      (student) =>
        student.full_name.toLowerCase().includes(normalized) ||
        (student.section ?? "").toLowerCase().includes(normalized) ||
        (student.level_label ?? "").toLowerCase().includes(normalized)
    );
  }, [students, query]);

  const selectedStudent: ProfileRow | undefined =
    filteredStudents.find((s) => s.id === selectedId) ?? filteredStudents[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Student roster</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="mt-4 w-full rounded-2xl border border-base bg-surface px-4 py-2.5 text-sm text-navy outline-none focus:border-gold"
          />

          {studentsLoading && <p className="mt-6 text-sm text-muted">Loading roster...</p>}
          {studentsError && <p className="mt-6 text-sm text-red-500">{studentsError}</p>}
          {!studentsLoading && !studentsError && filteredStudents.length === 0 && (
            <p className="mt-6 text-sm text-muted">No students found yet.</p>
          )}

          <div className="mt-6 max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {filteredStudents.map((student) => (
              <button
                type="button"
                key={student.id}
                onClick={() => setSelectedId(student.id)}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  selectedStudent?.id === student.id
                    ? "border-gold bg-[var(--surface-strong)]"
                    : "border-base bg-surface hover:border-gold"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{student.full_name}</p>
                    <p className="text-xs text-muted">
                      {student.level_label ?? "No level set"}
                      {student.section ? ` · ${student.section}` : ""}
                    </p>
                  </div>
                  <RankBadge rank={getStudentRankByProfile(student.id) ?? "D"} size="sm" />
                </div>
              </button>
            ))}
          </div>
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Selected student</p>
          {!selectedStudent ? (
            <p className="mt-4 text-sm text-muted">Select a student from the roster to see details.</p>
          ) : (
            <div className="mt-4 rounded-3xl border border-gold bg-[var(--surface-strong)] p-6">
              <div className="flex items-center gap-4">
                <img
                  src={selectedStudent.avatar_url || "/avatars/default-avatar.webp"}
                  alt={selectedStudent.full_name}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <p className="text-lg font-semibold text-navy">{selectedStudent.full_name}</p>
                  <p className="text-sm text-muted">
                    {selectedStudent.level_label ?? "No level set"}
                    {selectedStudent.section ? ` · ${selectedStudent.section}` : ""}
                  </p>
                  <RankBadge rank={getStudentRankByProfile(selectedStudent.id) ?? "D"} size="sm" className="mt-2" />
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm text-muted">
                <p><span className="font-semibold text-navy">Academic excellence:</span> {getStudentAverageByProfile(selectedStudent.id) ?? 0}/100</p>
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
