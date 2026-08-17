"use client";

import { useEffect, useMemo, useState } from "react";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useRankStore } from "@/lib/rankStore";
import { useAdminEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Bar } from "@/components/ui/Bar";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconUser, IconTrash, IconCheck, IconChevronRight } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/supabase";

/** Confirmation target for the destructive clear actions. */
type ClearTarget = { mode: "course"; courseId: string; courseName: string } | { mode: "all" } | null;

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
  const [confirmClear, setConfirmClear] = useState<ClearTarget>(null);

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

  // Effective enrollment row for a student (same shape `effectiveFrom` expects).
  function enrollmentRowFor(studentId: string) {
    const info = statuses[studentId];
    return info
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
      : null;
  }

  // School-wide snapshot computed from the same live statuses the rows use.
  const snapshot = useMemo(() => {
    let active = 0;
    let expired = 0;
    let revoked = 0;
    let unknown = 0;
    let expiringSoon = 0;
    const now = Date.now();
    const SOON_MS = 7 * 86_400_000; // "expiring soon" = within 7 days
    students.forEach((s) => {
      const eff = effectiveFrom(enrollmentRowFor(s.id));
      if (eff === "enrolled") {
        active += 1;
        const exp = statuses[s.id]?.expiresAt ? new Date(statuses[s.id]!.expiresAt!).getTime() : null;
        if (exp !== null && exp >= now && exp - now <= SOON_MS) expiringSoon += 1;
      } else if (eff === "expired") {
        expired += 1;
      } else if (eff === "revoked") {
        revoked += 1;
      } else {
        unknown += 1;
      }
    });
    return { active, expired, revoked, unknown, expiringSoon };
  }, [students, statuses]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function runClear(target: NonNullable<ClearTarget>) {
    if (!selectedStudent) return;
    setConfirmClear(null);
    if (target.mode === "course") {
      const res = await clearStudentCourseData(selectedStudent.id, target.courseId);
      if (res.removedCourses === 0 && res.removedGrades === 0) {
        setCourseMessage(null);
        setCourseError("Nothing to clear, or the removal was blocked by the database.");
      } else {
        setCourseMessage(
          `Cleared ${target.courseName} - removed ${res.removedGrades} grade${res.removedGrades === 1 ? "" : "s"}.`
        );
        setCourseError(null);
      }
    } else {
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
  }

  const selectedRank = selectedStudent ? rankOf(selectedStudent.id) : null;

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Monitor students</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Student management · {students.length} registered
          </h2>
        </div>
        <Stat
          label="School average"
          value={overallAvg !== null ? `${overallAvg} / 100` : "No grades yet"}
          tone="gold"
          hint="Weighted across all students"
        />
      </div>

      {error && (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>
      )}

      {loading ? (
        /* Skeleton: mirror the real two-column geometry. */
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <CornerFrame className="p-5">
            <div className="h-10 w-full animate-pulse rounded-[10px] bg-tile" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 rounded-[10px] border border-base p-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-tile" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded-full bg-tile" />
                    <div className="h-2.5 w-24 rounded-full bg-tile" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-tile" />
                </div>
              ))}
            </div>
          </CornerFrame>
          <CornerFrame className="p-5">
            <div className="flex animate-pulse items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-full bg-tile" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded-full bg-tile" />
                <div className="h-3 w-64 rounded-full bg-tile" />
              </div>
            </div>
            <div className="mt-5 grid animate-pulse grid-cols-2 gap-3">
              <div className="h-20 rounded-[8px] bg-tile" />
              <div className="h-20 rounded-[8px] bg-tile" />
            </div>
            <div className="mt-5 h-32 animate-pulse rounded-[10px] bg-tile" />
            <div className="mt-4 h-40 animate-pulse rounded-[10px] bg-tile" />
          </CornerFrame>
        </div>
      ) : students.length === 0 ? (
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconUser size={16} />}
            title="No students yet"
            desc="Students appear here as soon as they sign up and are verified in your school."
          />
        </CornerFrame>
      ) : (
        <>
          {/* ========================================================== */}
          {/* BAND 1 - SCHOOL SNAPSHOT                                 */}
          {/* ========================================================== */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Registered" value={students.length} tone="default" hint="All students in this school" />
            <Stat label="Active" value={snapshot.active} tone="gold" hint="Enrolled and current" />
            <Stat label="Expiring soon" value={snapshot.expiringSoon} tone={snapshot.expiringSoon > 0 ? "warn" : "muted"} hint="Within 7 days" />
            <Stat label="Revoked" value={snapshot.revoked} tone={snapshot.revoked > 0 ? "warn" : "muted"} hint="Access removed" />
          </section>

          {/* ========================================================== */}
          {/* BAND 2 - SEARCH / LIST / DETAIL                          */}
          {/* ========================================================== */}
          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            {/* Roster */}
            <CornerFrame className="p-5">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search students..."
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-2.5 pr-16 text-sm text-navy outline-none focus:border-gold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
                  {filtered.length}
                </span>
              </div>

              <div className="mt-4 max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <div className="py-6">
                    <EmptyState
                      icon={<IconUser size={16} />}
                      title="No students found"
                      desc="No students match the current search. Try a name, program, or year level."
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
                  filtered.map((student) => {
                    const avg = getStudentAverageByProfile(student.id);
                    const courseCount = getStudentRecordsByProfile(student.id).length;
                    const rank = rankOf(student.id)?.current_rank ?? "D";
                    const eff = effectiveFrom(enrollmentRowFor(student.id));
                    return (
                      <button
                        type="button"
                        key={student.id}
                        onClick={() => setSelectedId(student.id)}
                        className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition ${
                          selectedStudent?.id === student.id
                            ? "border-gold-token bg-[var(--surface-strong)]"
                            : "border-base bg-surface hover:border-gold-soft"
                        }`}
                      >
                        <UserAvatar name={student.full_name} src={student.avatar_url} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy">{student.full_name}</p>
                          <p className="truncate text-[11px] text-muted">
                            {[student.educational_level, student.program, student.level_label]
                              .filter(Boolean)
                              .join(" · ") || "No level set"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <RankBadge rank={rank} size="sm" />
                          <Chip
                            variant={
                              eff === "enrolled" ? "success" : eff === "expired" ? "warn" : eff === "revoked" ? "danger" : "neutral"
                            }
                          >
                            {eff}
                          </Chip>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CornerFrame>

            {/* Detail */}
            <CornerFrame className="p-5">
              {!selectedStudent ? (
                <div className="py-10">
                  <EmptyState
                    icon={<IconUser size={16} />}
                    title="Select a student"
                    desc="Pick a student from the roster to view their rank, enrollment, academic info, and course breakdown."
                  />
                </div>
              ) : (
                <>
                  {/* Identity + rank */}
                  <div className="flex flex-wrap items-center gap-4">
                    <UserAvatar
                      name={selectedStudent.full_name}
                      src={selectedStudent.avatar_url}
                      size="xl"
                      className="!border-2 !border-gold-token"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-navy">{selectedStudent.full_name}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {[selectedStudent.educational_level, selectedStudent.program, selectedStudent.level_label]
                          .filter(Boolean)
                          .join(" · ") || "No level set"}
                      </p>
                    </div>
                    {selectedRank && (
                      <div className="flex flex-col items-end gap-1.5">
                        <RankBadge
                          rank={selectedRank.current_rank}
                          bar={selectedRank.current_bar}
                          exScore={selectedRank.ex_score}
                          size="sm"
                        />
                        {selectedRank.current_rank !== "EX" && (
                          <div className="w-28">
                            <Bar value={selectedRank.current_bar} tone="gold" size="sm" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stat strip */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <Stat label="Grades recorded" value={getEntriesByProfile(selectedStudent.id).length} />
                    <Stat label="Courses" value={enrolledCourses.length} />
                    <Stat
                      label="Average"
                      value={getStudentAverageByProfile(selectedStudent.id) ?? "—"}
                      tone={getStudentAverageByProfile(selectedStudent.id) !== null ? "gold" : "muted"}
                    />
                  </div>

                  {/* Enrollment */}
                  <div className="mt-5 rounded-[10px] border border-gold-soft bg-[var(--surface-strong)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="section-label">Enrollment status</h3>
                      {(() => {
                        const eff = effectiveFrom(enrollmentRowFor(selectedStudent.id));
                        return (
                          <Chip
                            variant={
                              eff === "enrolled" ? "success" : eff === "expired" ? "warn" : eff === "revoked" ? "danger" : "neutral"
                            }
                          >
                            {eff}
                          </Chip>
                        );
                      })()}
                    </div>
                    {enrollLoading ? (
                      <p className="mt-2 text-sm text-muted">Loading...</p>
                    ) : (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
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
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                            Enrolled on
                            <input
                              type="date"
                              value={startDraft}
                              onChange={(e) => setStartDraft(e.target.value)}
                              className="rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                            Expiry
                            <input
                              type="date"
                              value={expiryDraft}
                              onChange={(e) => setExpiryDraft(e.target.value)}
                              className="rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                            />
                          </label>
                          <Button
                            variant="gold"
                            size="sm"
                            icon={<IconCheck size={13} />}
                            onClick={async () => {
                              const ok = await setEnrollment(
                                selectedStudent.id,
                                expiryDraft ? new Date(expiryDraft).toISOString() : null,
                                startDraft ? new Date(startDraft).toISOString() : null
                              );
                              setEnrollMessage(ok ? "Enrollment saved. It will lapse automatically after the expiry date." : "Couldn't save the enrollment.");
                            }}
                          >
                            {statuses[selectedStudent.id]?.expiresAt ? "Renew" : "Enroll"}
                          </Button>
                          {statuses[selectedStudent.id] && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={async () => {
                                await revokeEnrollment(selectedStudent.id);
                                setEnrollMessage("Enrollment revoked.");
                              }}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-[11px] text-muted">
                          Expiry is semester / academic-year based. Enrollment status can only be changed by an admin.
                        </p>
                        {enrollMessage && <p className="mt-2 text-xs text-gold-token">{enrollMessage}</p>}
                      </>
                    )}
                  </div>

                  {/* Academic info */}
                  <div className="mt-4 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
                    <h3 className="section-label">Academic info</h3>
                    <p className="mt-1 text-[11px] text-muted">
                      The education level and grade/year level are picked from what was set up in the Education Level
                      Management menu - shown on the student&apos;s profile, search results, and leaderboard.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Education level</span>
                        <select
                          value={edLevelId}
                          onChange={(e) => {
                            setEdLevelId(e.target.value);
                            setProgramId("");
                            setSectionId("");
                          }}
                          className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                        >
                          <option value="">None</option>
                          {educationLevels.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Program</span>
                        <select
                          value={programId}
                          onChange={(e) => {
                            setProgramId(e.target.value);
                            setSectionId("");
                          }}
                          disabled={!edLevelId}
                          className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold disabled:opacity-50"
                        >
                          <option value="">None</option>
                          {nestedPrograms.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Grade / year level</span>
                        <select
                          value={sectionId}
                          onChange={(e) => setSectionId(e.target.value)}
                          disabled={!programId}
                          className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold disabled:opacity-50"
                        >
                          <option value="">None</option>
                          {yearLevelSections.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<IconCheck size={13} />}
                        onClick={handleSaveAcademic}
                        disabled={savingAcademic}
                      >
                        {savingAcademic ? "Saving..." : "Save academic info"}
                      </Button>
                      {(() => {
                        const eff = effectiveFrom(enrollmentRowFor(selectedStudent.id));
                        return eff === "enrolled" ? (
                          <span className="text-[11px] font-semibold text-gold-token">
                            Enrollment verified - course access active.
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-warn">
                            Not verified - set the Enrolled on &amp; Expiry dates above to grant course access.
                          </span>
                        );
                      })()}
                    </div>
                    {academicMessage && <p className="mt-2 text-xs font-semibold text-gold-token">{academicMessage}</p>}
                    {academicError && <p className="mt-2 text-xs text-warn">{academicError}</p>}

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

                  {/* Per-course breakdown */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="section-label">Per-course breakdown</h3>
                      {enrolledCourses.length > 0 && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<IconTrash size={12} />}
                          onClick={() => setConfirmClear({ mode: "all" })}
                        >
                          Clear all course data
                        </Button>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5">
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
                              className="flex items-center justify-between gap-3 rounded-[10px] border border-base bg-surface px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-navy">{c.name}</p>
                                <p className="text-[11px] text-muted">
                                  {entries.length} grade{entries.length === 1 ? "" : "s"}
                                  {avg !== null ? ` · Avg ${avg}` : ""}
                                </p>
                              </div>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={<IconTrash size={12} />}
                                onClick={() => setConfirmClear({ mode: "course", courseId: c.id, courseName: c.name })}
                              >
                                Clear
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {courseMessage && <p className="mt-2 text-xs font-semibold text-gold-token">{courseMessage}</p>}
                    {courseError && <p className="mt-2 text-xs text-warn">{courseError}</p>}
                  </div>
                </>
              )}
            </CornerFrame>
          </section>
        </>
      )}

      {/* Confirm clear dialog */}
      {confirmClear && selectedStudent && (
        <Modal
          onClose={() => setConfirmClear(null)}
          eyebrow="Confirm clear"
          description={
            confirmClear.mode === "course"
              ? `Remove ${confirmClear.courseName} for ${selectedStudent.full_name}?`
              : `Clear ALL course data for ${selectedStudent.full_name}?`
          }
          maxWidth="max-w-sm"
        >
          <p className="text-sm leading-6 text-muted">
            {confirmClear.mode === "course"
              ? "This removes their enrollment and every grade for this course."
              : "This removes every course enrollment and grade. This cannot be undone."}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="danger" icon={<IconTrash size={13} />} onClick={() => runClear(confirmClear)}>
              {confirmClear.mode === "course" ? "Clear course" : "Clear everything"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmClear(null)}>
              Cancel
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-faint">
            <IconChevronRight size={12} />
            <span className="text-[10px] uppercase tracking-[0.15em]">Destructive action</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
