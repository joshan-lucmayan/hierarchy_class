"use client";

import { useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useAdminEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { RankBadge } from "@/components/ui/RankBadge";
import type { ProfileRow } from "@/types/supabase";

export default function AdminStudentsPage() {
  const { profiles: students, loading, error } = useSchoolProfiles({ role: "student" });
  const {
    courses,
    getStudentAverageByProfile,
    getStudentRankByProfile,
    getEntriesByProfile,
    getStudentRecordsByProfile,
  } = useClassroomHierarchy();
  const { statuses, loading: enrollLoading, setEnrollment, revokeEnrollment } = useAdminEnrollments();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState("");
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.level_label ?? "").toLowerCase().includes(q) ||
        (s.section ?? "").toLowerCase().includes(q)
    );
  }, [students, query]);

  const selectedStudent: ProfileRow | undefined =
    filtered.find((s) => s.id === selectedId) ?? filtered[0];

  const overallAvg = useMemo(() => {
    const avgs = students.map((s) => getStudentAverageByProfile(s.id)).filter((v): v is number => v !== null);
    if (avgs.length === 0) return null;
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
  }, [students, getStudentAverageByProfile]);

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? "Unknown course";

  const selectedCourseBreakdown = useMemo(() => {
    if (!selectedStudent) return [];
    const entries = getEntriesByProfile(selectedStudent.id);
    const byCourse = new Map<string, number[]>();
    entries.forEach((e) => {
      if (!byCourse.has(e.courseId)) byCourse.set(e.courseId, []);
      byCourse.get(e.courseId)!.push(e.score);
    });
    return Array.from(byCourse.entries()).map(([courseId, scores]) => ({
      courseId,
      courseName: courseName(courseId),
      avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      count: scores.length,
    }));
  }, [selectedStudent, getEntriesByProfile, courses]);

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Student Progress</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Monitor students</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Every real signed-up student at your school, with a live average and rank computed from actual grades.
            </p>
          </div>
          <div className="rounded-3xl border border-gold bg-[var(--surface-strong)] px-5 py-4 text-sm">
            <p className="font-semibold text-gold">School average</p>
            <p className="text-muted">{overallAvg !== null ? `${overallAvg} / 100` : "No grades yet"}</p>
          </div>
        </div>
      </CornerFrame>

      {loading && <p className="text-sm text-muted">Loading students...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-2xl border border-gold bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-navy outline-none"
            />
            <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-sm text-muted">No students match your search.</p>
              ) : (
                filtered.map((student) => {
                  const avg = getStudentAverageByProfile(student.id);
                  const rank = getStudentRankByProfile(student.id) ?? "D";
                  const courseCount = getStudentRecordsByProfile(student.id).length;
                  return (
                    <button
                      type="button"
                      key={student.id}
                      onClick={() => setSelectedId(student.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        selectedStudent?.id === student.id
                          ? "border-gold bg-[var(--surface-strong)]"
                          : "border-base bg-surface hover:border-gold"
                      }`}
                    >
                      <img
                        src={student.avatar_url || "/avatars/default-avatar.webp"}
                        alt={student.full_name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">{student.full_name}</p>
                        <p className="truncate text-xs text-muted">
                          {courseCount} course{courseCount === 1 ? "" : "s"} · {avg !== null ? `Avg ${avg}` : "No grades yet"}
                        </p>
                      </div>
                      <RankBadge rank={rank} size="sm" />
                    </button>
                  );
                })
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            {!selectedStudent ? (
              <p className="text-sm text-muted">Select a student from the roster to see details.</p>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <img
                    src={selectedStudent.avatar_url || "/avatars/default-avatar.webp"}
                    alt={selectedStudent.full_name}
                    className="h-16 w-16 rounded-full border-2 border-gold object-cover"
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

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
                    <p className="text-2xl font-bold text-navy">
                      {getStudentAverageByProfile(selectedStudent.id) ?? "--"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted">Academic Excellence</p>
                  </div>
                  <div className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-center">
                    <p className="text-2xl font-bold text-navy">{getEntriesByProfile(selectedStudent.id).length}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted">Grades recorded</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gold/40 bg-[var(--surface-strong)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Enrollment status</p>
                  {enrollLoading ? (
                    <p className="mt-2 text-sm text-muted">Loading...</p>
                  ) : (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {(() => {
                          const info = statuses[selectedStudent.id];
                          const effective = effectiveFrom(
                            info
                              ? ({
                                  student_id: info.studentId,
                                  school_id: "",
                                  status: info.status as "enrolled" | "revoked",
                                  started_at: info.startedAt ?? "",
                                  expires_at: info.expiresAt,
                                  updated_by: null,
                                  created_at: "",
                                  updated_at: "",
                                } as any)
                              : null
                          );
                          return (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                                effective === "enrolled"
                                  ? "bg-gold/20 text-gold"
                                  : effective === "expired"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : effective === "revoked"
                                  ? "bg-red-500/15 text-red-600"
                                  : "bg-gray-500/15 text-gray-500"
                              }`}
                            >
                              {effective}
                            </span>
                          );
                        })()}
                        {statuses[selectedStudent.id]?.expiresAt && (
                          <span className="text-xs text-muted">
                            until {new Date(statuses[selectedStudent.id]!.expiresAt!).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={expiryDraft}
                          onChange={(e) => setExpiryDraft(e.target.value)}
                          className="rounded-2xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await setEnrollment(selectedStudent.id, expiryDraft ? new Date(expiryDraft).toISOString() : null);
                            setEnrollMessage(ok ? "Enrollment saved. It will lapse automatically after the expiry date." : "Couldn't save the enrollment.");
                          }}
                          className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-navy transition hover:opacity-90"
                        >
                          {statuses[selectedStudent.id]?.expiresAt ? "Renew" : "Enroll"}
                        </button>
                        {statuses[selectedStudent.id] && (
                          <button
                            type="button"
                            onClick={async () => {
                              await revokeEnrollment(selectedStudent.id);
                              setEnrollMessage("Enrollment revoked.");
                            }}
                            className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-[11px] text-muted">
                        Expiry is semester / academic-year based. Enrollment status can only be changed by an admin.
                      </p>
                      {enrollMessage && <p className="mt-2 text-xs text-emerald-600">{enrollMessage}</p>}
                    </>
                  )}
                </div>

                <div className="mt-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Per-course breakdown</p>
                  <div className="mt-3 space-y-2">
                    {selectedCourseBreakdown.length === 0 ? (
                      <p className="text-sm text-muted">No grades recorded in any course yet.</p>
                    ) : (
                      selectedCourseBreakdown.map((c) => (
                        <div key={c.courseId} className="flex items-center justify-between rounded-xl border border-base px-3 py-2">
                          <div>
                            <p className="text-sm text-navy">{c.courseName}</p>
                            <p className="text-xs text-muted">{c.count} grade{c.count === 1 ? "" : "s"}</p>
                          </div>
                          <p className="text-sm font-bold text-gold">{c.avg}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </CornerFrame>
        </section>
      )}
    </div>
  );
}
