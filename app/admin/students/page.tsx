"use client";

import { useEffect, useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useRankStore } from "@/lib/rankStore";
import { useAdminEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ActionButton } from "@/components/ui/ActionButton";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/supabase";

export default function AdminStudentsPage() {
  const { profiles: students, loading, error, refetch: refetchStudents } = useSchoolProfiles({ role: "student" });
  const {
    courses,
    sections,
    programs,
    getStudentAverageByProfile,
    getEntriesByProfile,
    getStudentRecordsByProfile,
    autoEnrollInSection,
    clearStudentCourseData,
  } = useClassroomHierarchy();
  const { rankOf } = useRankStore();
  const { statuses, loading: enrollLoading, setEnrollment, revokeEnrollment } = useAdminEnrollments();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState("");
  const [expiryDraft, setExpiryDraft] = useState("");
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);
  // Academic cascade holds selected IDs (not names) so the year/level list
  // can never silently come back empty due to name collisions.
  const [edLevelId, setEdLevelId] = useState("");
  const [programId, setProgramId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [academicMessage, setAcademicMessage] = useState<string | null>(null);
  const [academicError, setAcademicError] = useState<string | null>(null);
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [courseMessage, setCourseMessage] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.level_label ?? "").toLowerCase().includes(q) ||
        (s.program ?? "").toLowerCase().includes(q)
    );
  }, [students, query]);

  const selectedStudent: ProfileRow | undefined =
    filtered.find((s) => s.id === selectedId) ?? filtered[0];

  // Hydrate the academic-edit selections whenever the selected student changes.
  useEffect(() => {
    if (selectedStudent) {
      const ed = programs.find((p) => !p.parentId && p.name === selectedStudent.educational_level);
      const prog = programs.find(
        (p) => p.parentId === ed?.id && p.name === (selectedStudent as any).program
      );
      const sec = sections.find((s) => s.programId === prog?.id && s.name === selectedStudent.level_label);
      setEdLevelId(ed?.id ?? "");
      setProgramId(prog?.id ?? "");
      setSectionId(sec?.id ?? "");
      // Enrollment dates come from the live status row.
      const info = statuses[selectedStudent.id];
      setStartDraft(info?.startedAt ? new Date(info.startedAt).toISOString().slice(0, 10) : "");
      setExpiryDraft(info?.expiresAt ? new Date(info.expiresAt).toISOString().slice(0, 10) : "");
      setEnrollMessage(null);
      setAcademicMessage(null);
      setAcademicError(null);
      setCourseMessage(null);
      setCourseError(null);
    }
    // Re-hydrate when the selected student changes AND when enrollment data
    // arrives/updates (statuses keyed by student id).
  }, [selectedStudent?.id, statuses]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAcademicInfo = useMemo(() => {
    if (!selectedStudent) return null;
    const courseIds = getStudentRecordsByProfile(selectedStudent.id).map((r) => r.courseId);
    const myCourses = courses.filter((c) => courseIds.includes(c.id));
    const secIds = Array.from(new Set(myCourses.map((c) => c.sectionId)));
    const mySections = sections.filter((s) => secIds.includes(s.id));
    const progIds = Array.from(new Set(mySections.map((s) => s.programId)));
    return {
      programs: programs.filter((p) => progIds.includes(p.id)),
      sections: mySections,
      courses: myCourses,
    };
  }, [selectedStudent, getStudentRecordsByProfile, courses, sections, programs]);

  async function handleSaveAcademic() {
    if (!selectedStudent) return;
    setSavingAcademic(true);
    setAcademicMessage(null);
    setAcademicError(null);
    const supabase = createClient();
    const levelName = educationLevels.find((l) => l.id === edLevelId)?.name ?? null;
    const programName = nestedPrograms.find((p) => p.id === programId)?.name ?? null;
    const sectionName = yearLevelSections.find((s) => s.id === sectionId)?.name ?? null;
    const { error } = await (supabase.from("profiles") as any)
      .update({
        level_label: sectionName,
        educational_level: levelName,
        program: programName,
      })
      .eq("id", selectedStudent.id);
    if (error) {
      setSavingAcademic(false);
      setAcademicError("Couldn't save the academic info. Only admins can edit these fields.");
      return;
    }
    // Grant course access: enroll the student in every course under the chosen
    // year/level section (skips courses they're already in).
    let enrolled = 0;
    if (sectionId) enrolled = await autoEnrollInSection(sectionId, selectedStudent.id);
    // Refresh the roster so the student's stored level/program/year show
    // immediately (realtime also covers this, but don't wait on it).
    refetchStudents();
    setSavingAcademic(false);
    setAcademicMessage(
      enrolled > 0
        ? `Academic info saved - enrolled in ${enrolled} course${enrolled === 1 ? "" : "s"} under ${sectionName}.`
        : "Academic info saved."
    );
  }
  const overallAvg = useMemo(() => {
    const avgs = students.map((s) => getStudentAverageByProfile(s.id)).filter((v): v is number => v !== null);
    if (avgs.length === 0) return null;
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
  }, [students, getStudentAverageByProfile]);

  // Education-level cascade: top-level programs are EDUCATION LEVELS, programs
  // with a parent are the PROGRAMS inside them, and sections are the year/levels.
  const educationLevels = programs.filter((p) => !p.parentId);
  const nestedPrograms = edLevelId ? programs.filter((p) => p.parentId === edLevelId) : [];
  const yearLevelSections = programId ? sections.filter((s) => s.programId === programId) : [];

  // Every course the student is enrolled in (not just ones with grades) so the
  // admin can clear any of them.
  const enrolledCourses = useMemo(() => {
    if (!selectedStudent) return [];
    const myIds = getStudentRecordsByProfile(selectedStudent.id).map((r) => r.courseId);
    return courses.filter((c) => myIds.includes(c.id));
  }, [selectedStudent, getStudentRecordsByProfile, courses]);

  async function handleClearCourse(courseId: string, courseName: string) {
    if (!selectedStudent) return;
    if (
      !confirm(
        `Clear \"${courseName}\" for ${selectedStudent.full_name}? This removes their enrollment and every grade for this course.`
      )
    )
      return;
    const res = await clearStudentCourseData(selectedStudent.id, courseId);
    if (res.removedCourses === 0 && res.removedGrades === 0) {
      setCourseMessage(null);
      setCourseError("Nothing to clear, or the removal was blocked by the database.");
    } else {
      setCourseMessage(
        `Cleared ${courseName} - removed ${res.removedGrades} grade${res.removedGrades === 1 ? "" : "s"}.`
      );
      setCourseError(null);
    }
  }

  async function handleClearAllCourses() {
    if (!selectedStudent) return;
    if (
      !confirm(
        `Clear ALL course data for ${selectedStudent.full_name}? This removes every course enrollment and grade. This cannot be undone.`
      )
    )
      return;
    const res = await clearStudentCourseData(selectedStudent.id);
    if (res.removedCourses === 0 && res.removedGrades === 0) {
      setCourseMessage(null);
      setCourseError("No course data to clear.");
    } else {
      setCourseMessage(
        `Cleared all course data - removed ${res.removedCourses} enrollment${res.removedCourses === 1 ? "" : "s"} and ${res.removedGrades} grade${res.removedGrades === 1 ? "" : "s"}.`
      );
      setCourseError(null);
    }
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Student Progress</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Monitor students</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Every real signed-up student at your school, with a live average and rank computed from actual grades.
            </p>
          </div>
          <div className="rounded-[10px] border border-base bg-[var(--surface-strong)] px-5 py-4 text-sm">
            <p className="font-semibold text-gold">School average</p>
            <p className="text-muted">{overallAvg !== null ? `${overallAvg} / 100` : "No grades yet"}</p>
          </div>
        </div>
      </CornerFrame>

      {loading && <p className="text-sm text-muted">Loading students...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-[10px] border border-gold bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-navy outline-none"
            />
            <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-sm text-muted">No students match your search.</p>
              ) : (
                filtered.map((student) => {
                  const avg = getStudentAverageByProfile(student.id);
                  const courseCount = getStudentRecordsByProfile(student.id).length;
                  return (
                    <button
                      type="button"
                      key={student.id}
                      onClick={() => setSelectedId(student.id)}
                      className={`flex w-full items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition ${
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
                    </button>
                  );
                })
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
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
                      {[selectedStudent.educational_level, selectedStudent.program, selectedStudent.level_label]
                        .filter(Boolean)
                        .join(" · ") || "No level set"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-4 text-center">
                    <p className="text-2xl font-extrabold text-navy">
                      {rankOf(selectedStudent.id)?.current_rank ?? "D"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted">Current rank</p>
                  </div>
                  <div className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-4 text-center">
                    <p className="text-2xl font-bold text-navy">{getEntriesByProfile(selectedStudent.id).length}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted">Grades recorded</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[10px] border border-gold/40 bg-[var(--surface-strong)] p-4">
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
                                  : "bg-muted/15 text-muted"
                              }`}
                            >
                              {effective}
                            </span>
                          );
                        })()}
                        {statuses[selectedStudent.id]?.startedAt && (
                          <span className="text-xs text-muted">
                            since {new Date(statuses[selectedStudent.id]!.startedAt!).toLocaleDateString()}
                          </span>
                        )}
                        {statuses[selectedStudent.id]?.expiresAt && (
                          <span className="text-xs text-muted">
                            until {new Date(statuses[selectedStudent.id]!.expiresAt!).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted">
                          <span className="shrink-0">Enrolled on</span>
                          <input
                            type="date"
                            value={startDraft}
                            onChange={(e) => setStartDraft(e.target.value)}
                            className="rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          <span className="shrink-0">Expiry</span>
                          <input
                            type="date"
                            value={expiryDraft}
                            onChange={(e) => setExpiryDraft(e.target.value)}
                            className="rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await setEnrollment(
                              selectedStudent.id,
                              expiryDraft ? new Date(expiryDraft).toISOString() : null,
                              startDraft ? new Date(startDraft).toISOString() : null
                            );
                            setEnrollMessage(ok ? "Enrollment saved. It will lapse automatically after the expiry date." : "Couldn't save the enrollment.");
                          }}
                          className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-on-accent transition hover:opacity-90"
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

                <div className="mt-6 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Academic info</p>
                  <p className="mt-1 text-[11px] text-muted">
                    The education level and grade/year level are picked from what was set up in the Education Level
                    Management menu - shown on the student&apos;s profile, search results, and leaderboard.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-xs text-muted">Education level</span>
                      <select
                        value={edLevelId}
                        onChange={(e) => {
                          setEdLevelId(e.target.value);
                          setProgramId("");
                          setSectionId("");
                        }}
                        className="w-full rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                      >
                        <option value="">None</option>
                        {educationLevels.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-muted">Program</span>
                      <select
                        value={programId}
                        onChange={(e) => {
                          setProgramId(e.target.value);
                          setSectionId("");
                        }}
                        disabled={!edLevelId}
                        className="w-full rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold disabled:opacity-50"
                      >
                        <option value="">None</option>
                        {nestedPrograms.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-muted">Grade / year level</span>
                      <select
                        value={sectionId}
                        onChange={(e) => setSectionId(e.target.value)}
                        disabled={!programId}
                        className="w-full rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold disabled:opacity-50"
                      >
                        <option value="">None</option>
                        {yearLevelSections.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <ActionButton
                    variant="navy"
                    onClick={handleSaveAcademic}
                    disabled={savingAcademic}
                    className="mt-3"
                  >
                    {savingAcademic ? "Saving..." : "Save academic info"}
                  </ActionButton>
                  {academicMessage && <p className="mt-2 text-xs font-semibold text-emerald-600">{academicMessage}</p>}
                  {academicError && <p className="mt-2 text-xs text-red-500">{academicError}</p>}

                  {(() => {
                    const info = statuses[selectedStudent.id];
                    const active =
                      effectiveFrom(
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
                      ) === "enrolled";
                    return active ? (
                      <p className="mt-2 text-[11px] font-semibold text-emerald-600">
                        ● Enrollment verified - course access active.
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] font-semibold text-amber-600">
                        ● Not verified - set the Enrolled on &amp; Expiry dates above to grant course access.
                      </p>
                    );
                  })()}

                  {selectedAcademicInfo && selectedAcademicInfo.programs.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-base pt-3">
                      {selectedAcademicInfo.programs.map((p) => (
                        <div key={p.id}>
                          <p className="text-xs font-semibold text-navy">Program: {p.name}</p>
                          {selectedAcademicInfo.sections
                            .filter((s) => s.programId === p.id)
                            .map((s) => (
                              <p key={s.id} className="text-[11px] text-muted">
                                Section / Year: {s.name} ·{" "}
                                {selectedAcademicInfo.courses
                                  .filter((c) => c.sectionId === s.id)
                                  .map((c) => c.name)
                                  .join(", ")}
                              </p>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Per-course breakdown</p>
                    {enrolledCourses.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllCourses}
                        className="rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                      >
                        Clear all course data
                      </button>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {enrolledCourses.length === 0 ? (
                      <p className="text-sm text-muted">Not enrolled in any courses yet.</p>
                    ) : (
                      enrolledCourses.map((c) => {
                        const entries = getEntriesByProfile(selectedStudent.id).filter(
                          (e) => e.courseId === c.id
                        );
                        const avg =
                          entries.length === 0
                            ? null
                            : Math.round(
                                (entries.reduce((a, b) => a + b.score, 0) / entries.length) * 10
                              ) / 10;
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-3 rounded-[10px] border border-base px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-navy">{c.name}</p>
                              <p className="text-xs text-muted">
                                {entries.length} grade{entries.length === 1 ? "" : "s"}
                                {avg !== null ? ` · Avg ${avg}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleClearCourse(c.id, c.name)}
                              className="shrink-0 rounded-full border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                            >
                              Clear
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {courseMessage && <p className="mt-2 text-xs font-semibold text-emerald-600">{courseMessage}</p>}
                  {courseError && <p className="mt-2 text-xs text-red-500">{courseError}</p>}
                </div>
              </>
            )}
          </CornerFrame>
        </section>
      )}
    </div>
  );
}
