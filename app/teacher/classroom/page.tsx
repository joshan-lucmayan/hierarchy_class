"use client";

import { useState } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { CornerFrame } from "@/components/ui/CornerFrame";

type Step = "programs" | "sections" | "courses" | "students";
type GradeType = "Exam" | "Quiz" | "Activity" | "Assignment";
const GRADE_TYPES: GradeType[] = ["Quiz", "Exam", "Activity", "Assignment"];
const TODAY = new Date().toISOString().split("T")[0];

export default function TeacherClassroomPage() {
  const { profile } = useMyProfile();
  const {
    programs,
    sections,
    getSectionsByProgram,
    getCoursesBySection,
    getCoursesByTeacher,
    getStudentsByCourse,
    getEntriesByStudent,
    getStudentAverage,
    getStudentRank,
    getCourseLeaderboard,
    submitGrades,
  } = useClassroomHierarchy();

  const [step, setStep] = useState<Step>("programs");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const [gradeType, setGradeType] = useState<GradeType>("Quiz");
  const [gradeLabel, setGradeLabel] = useState("");
  const [gradeDate, setGradeDate] = useState(TODAY);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Only courses assigned to this teacher's real signed-up profile
  const myCourses = profile ? getCoursesByTeacher(profile.id) : [];
  const mySectionIds = new Set(myCourses.map((c) => c.sectionId));
  const mySections = sections.filter((s) => mySectionIds.has(s.id));
  const myProgramIds = new Set(mySections.map((s) => s.programId));
  const myPrograms = programs.filter((p) => myProgramIds.has(p.id));

  const sectionsForProgram = selectedProgram
    ? getSectionsByProgram(selectedProgram).filter((s) => mySectionIds.has(s.id))
    : [];
  const coursesForSection = selectedSection
    ? getCoursesBySection(selectedSection).filter((c) => c.teacherId === profile?.id)
    : [];
  const students = selectedCourse ? getStudentsByCourse(selectedCourse) : [];
  const leaderboard = selectedCourse ? getCourseLeaderboard(selectedCourse) : [];

  function handleBack() {
    setSubmitted(false);
    if (step === "students") { setStep("courses"); setSelectedCourse(null); }
    else if (step === "courses") { setStep("sections"); setSelectedSection(null); }
    else if (step === "sections") { setStep("programs"); setSelectedProgram(null); }
  }

  async function handleSubmitGrades() {
    if (!selectedCourse) return;
    setSubmitError(null);
    const entries = students
      .filter((s) => scoreInputs[s.id] !== undefined && scoreInputs[s.id] !== "")
      .map((s) => ({
        studentId: s.id,
        courseId: selectedCourse,
        type: gradeType,
        score: Math.min(100, Math.max(0, Number(scoreInputs[s.id]))),
        date: gradeDate,
        label: gradeLabel || gradeType,
      }));
    if (entries.length === 0) return;
    const ok = await submitGrades(entries);
    if (!ok) {
      setSubmitError("Couldn't submit grades. Check the student roster and try again.");
      return;
    }
    setScoreInputs({});
    setGradeLabel("");
    setSubmitted(true);
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
          <p className="text-sm text-muted">Loading your profile...</p>
        </CornerFrame>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Classroom</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Grade submission</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Showing only the programs, sections, and courses assigned to you by admin.
        </p>
      </CornerFrame>

      {step === "programs" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-navy">Select your program:</p>
          {myPrograms.length === 0 ? (
            <p className="text-sm text-muted">No courses have been assigned to you yet. Contact admin.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myPrograms.map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => { setSelectedProgram(prog.id); setStep("sections"); }}
                  className="flex flex-col items-start rounded-3xl border border-base bg-surface p-6 text-left shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <p className="text-lg font-bold text-navy">{prog.name}</p>
                  {prog.description && <p className="mt-2 text-xs text-muted">{prog.description}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "sections" && (
        <div className="space-y-3">
          <button onClick={handleBack} className="text-sm font-semibold text-gold hover:text-gold/80">← Back</button>
          <p className="text-sm font-semibold text-navy">Select section:</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectionsForProgram.map((sec) => (
              <button
                key={sec.id}
                onClick={() => { setSelectedSection(sec.id); setStep("courses"); }}
                className="flex flex-col items-center justify-center rounded-3xl border-2 border-base bg-surface p-10 text-center shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="text-2xl font-bold text-navy">{sec.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "courses" && (
        <div className="space-y-3">
          <button onClick={handleBack} className="text-sm font-semibold text-gold hover:text-gold/80">← Back</button>
          <p className="text-sm font-semibold text-navy">Select course:</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coursesForSection.map((crs) => (
              <button
                key={crs.id}
                onClick={() => { setSelectedCourse(crs.id); setStep("students"); setSubmitted(false); }}
                className="flex flex-col items-start rounded-3xl border border-base bg-surface p-6 text-left shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="text-lg font-bold text-navy">{crs.name}</p>
                {crs.code && <p className="mt-1 text-xs text-muted">{crs.code}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "students" && (
        <div className="space-y-6">
          <button onClick={handleBack} className="text-sm font-semibold text-gold hover:text-gold/80">← Back</button>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Submit grades</p>

            {submitted && (
              <div className="mt-3 rounded-2xl bg-green-500/10 border border-green-500/30 px-4 py-2">
                <p className="text-sm font-semibold text-green-600">Grades submitted and sent for admin approval.</p>
              </div>
            )}
            {submitError && (
              <div className="mt-3 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-2">
                <p className="text-sm font-semibold text-red-600">{submitError}</p>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted">Type</p>
                <div className="flex flex-wrap gap-2">
                  {GRADE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setGradeType(t)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        gradeType === t
                          ? "bg-gold text-navy"
                          : "border border-base text-muted hover:border-gold hover:text-gold"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted">Label (optional)</p>
                <input
                  value={gradeLabel}
                  onChange={(e) => setGradeLabel(e.target.value)}
                  placeholder={`e.g. ${gradeType} 1`}
                  className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted">Date</p>
                <input
                  type="date"
                  value={gradeDate}
                  onChange={(e) => setGradeDate(e.target.value)}
                  className="w-full rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {students.map((std) => {
                const avg = getStudentAverage(std.id);
                const rank = getStudentRank(std.id);
                return (
                  <div key={std.id} className="flex items-center gap-3 rounded-2xl border border-base bg-[var(--surface-strong)] p-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-navy">{std.name}</p>
                      <p className="text-xs text-muted">
                        Avg: {avg !== null ? `${avg}` : "No grades yet"}
                        {rank ? ` · ${rank}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={scoreInputs[std.id] ?? ""}
                        onChange={(e) => setScoreInputs((prev) => ({ ...prev, [std.id]: e.target.value }))}
                        placeholder="0-100"
                        className="w-20 rounded-lg border border-base bg-surface px-2 py-1.5 text-center text-sm text-navy outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSubmitGrades}
              className="mt-4 w-full rounded-full bg-gold py-3 text-sm font-semibold text-navy transition hover:opacity-90"
            >
              Submit grades
            </button>
          </CornerFrame>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Course leaderboard</p>
            <div className="mt-4 space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.student.id} className="flex items-center gap-3 rounded-2xl border border-base bg-[var(--surface-strong)] p-3">
                  <p className="w-6 text-center text-xs font-bold text-muted">{i + 1}</p>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{entry.student.name}</p>
                  </div>
                  <p className="text-sm font-bold text-gold">{entry.avg > 0 ? entry.avg : "-"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    entry.rank === "S++" ? "bg-navy text-gold" :
                    entry.rank === "S" ? "bg-gold text-navy" :
                    entry.rank === "A" ? "bg-blue-100 text-blue-700" :
                    entry.rank === "B" ? "bg-green-100 text-green-700" :
                    entry.rank === "C" ? "bg-gray-100 text-gray-600" :
                    "bg-red-100 text-red-600"
                  }`}>{entry.rank}</span>
                </div>
              ))}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Grade history</p>
            <div className="mt-4 space-y-4">
              {students.map((std) => {
                const entries = getEntriesByStudent(std.id).sort((a, b) => b.date.localeCompare(a.date));
                return (
                  <div key={std.id}>
                    <p className="text-sm font-bold text-navy">{std.name}</p>
                    {entries.length === 0 ? (
                      <p className="text-xs text-muted">No entries yet.</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {entries.map((e) => (
                          <div key={e.id} className="flex items-center justify-between rounded-lg border border-base px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-muted">{e.type}</span>
                              <p className="text-xs text-navy">{e.label}</p>
                              <p className="text-[10px] text-muted">{e.date}</p>
                            </div>
                            <p className="text-sm font-bold text-gold">{e.score}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CornerFrame>
        </div>
      )}
    </div>
  );
}
