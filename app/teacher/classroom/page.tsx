"use client";

import { useEffect, useMemo, useState } from "react";
import { useClassroomHierarchy, CourseCategory } from "@/lib/classroomHierarchyStore";
import { useRankStore } from "@/lib/rankStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { CornerFrame } from "@/components/ui/CornerFrame";

type Step = "programs" | "sections" | "courses" | "students";
const TODAY = new Date().toISOString().split("T")[0];

interface CategoryDraft {
  key: string;
  label: string;
  weight: string;
}

const DEFAULT_CATEGORIES: CategoryDraft[] = [
  { key: "quiz", label: "Quiz", weight: "20" },
  { key: "exam", label: "Exam", weight: "40" },
  { key: "activity", label: "Activity", weight: "25" },
  { key: "participation", label: "Participation", weight: "15" },
];

function slugify(s: string): string {
  return (
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") ||
    "category"
  );
}

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
    getCourseWeightedAverage,
    getCourseLeaderboard,
    submitGrades,
    getCourseRankWeights,
    saveCourseRankWeights,
    activeSemester,
  } = useClassroomHierarchy();
  const { rankOf } = useRankStore();

  const [step, setStep] = useState<Step>("programs");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Submit form state. `gradeType` is the LABEL of one of the course's
  // configured categories (what grade_entries.type stores).
  const [gradeType, setGradeType] = useState<string>(DEFAULT_CATEGORIES[0].label);
  const [gradeLabel, setGradeLabel] = useState("");
  const [gradeDate, setGradeDate] = useState(TODAY);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [maxInputs, setMaxInputs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The course's category list - the teacher can add, remove and edit rows.
  const [categoryDrafts, setCategoryDrafts] = useState<CategoryDraft[]>(DEFAULT_CATEGORIES);
  const [weightsMsg, setWeightsMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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

  // Load the course's configured categories when a course is picked.
  useEffect(() => {
    if (!selectedCourse) return;
    const stored = getCourseRankWeights(selectedCourse);
    if (stored && stored.length > 0) {
      setCategoryDrafts(stored.map((c) => ({ key: c.key, label: c.label, weight: String(c.weight) })));
      setGradeType(stored[0].label);
    } else {
      setCategoryDrafts(DEFAULT_CATEGORIES);
      setGradeType(DEFAULT_CATEGORIES[0].label);
    }
    setWeightsMsg(null);
    setGradeLabel("");
  }, [selectedCourse, getCourseRankWeights]);

  const weightsTotal = useMemo(
    () =>
      categoryDrafts.reduce((acc, c) => acc + (Number.isFinite(Number(c.weight)) ? Number(c.weight) : 0), 0),
    [categoryDrafts]
  );

  function handleBack() {
    setSubmitted(false);
    if (step === "students") { setStep("courses"); setSelectedCourse(null); }
    else if (step === "courses") { setStep("sections"); setSelectedSection(null); }
    else if (step === "sections") { setStep("programs"); setSelectedProgram(null); }
  }

  function updateDraft(index: number, patch: Partial<CategoryDraft>) {
    setCategoryDrafts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeDraft(index: number) {
    const removed = categoryDrafts[index];
    setCategoryDrafts((prev) => prev.filter((_, i) => i !== index));
    if (removed && removed.label === gradeType && categoryDrafts.length > 1) {
      const next = categoryDrafts.find((c, i) => i !== index);
      if (next) setGradeType(next.label);
    }
  }

  async function handleSaveWeights() {
    if (!selectedCourse) return;
    if (categoryDrafts.length === 0) {
      setWeightsMsg({ kind: "err", text: "Add at least one category before saving." });
      return;
    }
    if (Math.abs(weightsTotal - 100) > 0.01) {
      setWeightsMsg({ kind: "err", text: `Weights must total 100% (currently ${weightsTotal}%).` });
      return;
    }
    for (const c of categoryDrafts) {
      if (!c.label.trim()) {
        setWeightsMsg({ kind: "err", text: "Every category needs a label." });
        return;
      }
      const w = Number(c.weight);
      if (!Number.isFinite(w) || w < 0) {
        setWeightsMsg({ kind: "err", text: "All weights must be non-negative numbers." });
        return;
      }
    }
    // Keys are derived from labels when missing, and forced unique so the
    // engine's category keys never collide.
    const seen = new Set<string>();
    const cats: CourseCategory[] = categoryDrafts.map((c) => {
      let key = (c.key.trim() || slugify(c.label));
      let k = key;
      let i = 2;
      while (seen.has(k)) { k = `${key}_${i++}`; }
      seen.add(k);
      return { key: k, label: c.label.trim(), weight: Number(c.weight) };
    });
    const ok = await saveCourseRankWeights(selectedCourse, cats);
    setWeightsMsg(
      ok
        ? { kind: "ok", text: "Categories saved - the leaderboard and rank feed now use them." }
        : { kind: "err", text: "Couldn't save categories. Check the values and try again." }
    );
  }

  async function handleSubmitGrades() {
    if (!selectedCourse) return;
    setSubmitError(null);
    const entries = students
      .filter((s) => scoreInputs[s.id] !== undefined && scoreInputs[s.id] !== "")
      .map((s) => {
        const earned = Number(scoreInputs[s.id]);
        const max = Number(maxInputs[s.id] || "100");
        return {
          studentId: s.id,
          courseId: selectedCourse,
          type: gradeType,
          score: Math.max(0, earned),
          maxScore: Math.max(1, max),
          date: gradeDate,
          label: gradeLabel || gradeType,
        };
      });
    if (entries.length === 0) return;
    const res = await submitGrades(entries);
    if (!res.ok) {
      setSubmitError(res.error ?? "Couldn't submit grades. Check the student roster and try again.");
      return;
    }
    setScoreInputs({});
    setMaxInputs({});
    setGradeLabel("");
    setSubmitted(true);
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <p className="text-sm text-muted">Loading your profile...</p>
        </CornerFrame>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Classroom</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Grade submission</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Configure each course&apos;s categories - add, remove or rename them and set their
          weights (they must total 100%) - then enter every student&apos;s earned score and the
          &quot;out of&quot; max (e.g. 24 out of 50). Grades go to the admin for approval -
          approved grades feed the rank engine automatically.
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
                  className="flex flex-col items-start rounded-[10px] border border-base bg-surface p-6 text-left transition hover:border-sealion"
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
                className="flex flex-col items-center justify-center rounded-[10px] border border-base bg-surface p-10 text-center transition hover:border-sealion"
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
                className="flex flex-col items-start rounded-[10px] border border-base bg-surface p-6 text-left transition hover:border-sealion"
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

          {/* Category editor - add / remove / edit per course */}
          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Course categories</p>
              <p className={`text-xs font-semibold ${Math.abs(weightsTotal - 100) > 0.01 ? "text-red-500" : "text-emerald-600"}`}>
                Total: {weightsTotal}%
              </p>
            </div>
            <p className="mt-2 text-sm text-muted">
              The categories this course grades by - add, remove or rename them and set each
              weight. They must total 100%. The submit form and the rank feed use these categories.
            </p>
            <div className="mt-4 space-y-2">
              {categoryDrafts.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={c.label}
                    onChange={(e) => updateDraft(i, { label: e.target.value })}
                    placeholder="Category label (e.g. Quiz)"
                    className="flex-1 rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={c.weight}
                      onChange={(e) => updateDraft(i, { weight: e.target.value })}
                      className="w-20 rounded-lg border border-base bg-[var(--surface-strong)] px-3 py-2 text-right text-sm text-navy outline-none focus:border-gold"
                    />
                    <span className="text-xs text-muted">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraft(i)}
                    className="rounded-full border border-base px-2.5 py-1.5 text-xs text-muted transition hover:border-red-400 hover:text-red-500"
                    title="Remove category"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setCategoryDrafts((prev) => [...prev, { key: "", label: "", weight: "0" }])}
                className="rounded-full border border-base px-4 py-2 text-xs font-semibold text-muted transition hover:border-gold hover:text-gold"
              >
                + Add category
              </button>
              <button
                type="button"
                onClick={handleSaveWeights}
                className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-on-accent transition hover:opacity-90"
              >
                Save categories
              </button>
              {weightsMsg && (
                <p className={`text-xs ${weightsMsg.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>{weightsMsg.text}</p>
              )}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Submit grades</p>

            {!activeSemester && (
              <div className="mt-4 rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-4 py-4">
                <p className="text-sm font-semibold text-amber-600">The semester hasn&apos;t started yet.</p>
                <p className="mt-1 text-sm text-muted">
                  Grades can&apos;t be submitted until the admin starts the semester. Contact your
                  admin - they can declare it from the Admin &gt; Ranks page.
                </p>
              </div>
            )}

            {submitted && (
              <div className="mt-3 rounded-[10px] bg-green-500/10 border border-green-500/30 px-4 py-2">
                <p className="text-sm font-semibold text-green-600">Grades submitted and sent for admin approval.</p>
              </div>
            )}
            {submitError && (
              <div className="mt-3 rounded-[10px] bg-red-500/10 border border-red-500/30 px-4 py-2">
                <p className="text-sm font-semibold text-red-600">{submitError}</p>
              </div>
            )}

            {!activeSemester ? (
              <p className="mt-3 text-sm text-muted">
                Submissions are blocked until the semester is active.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted">Category</p>
                <div className="flex flex-wrap gap-2">
                  {categoryDrafts.map((c) => (
                    <button
                      key={c.key || c.label}
                      type="button"
                      onClick={() => setGradeType(c.label)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        gradeType === c.label
                          ? "bg-gold text-on-accent"
                          : "border border-base text-muted hover:border-gold hover:text-gold"
                      }`}
                    >
                      {c.label || "Untitled"}
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
                const avg = getCourseWeightedAverage(selectedCourse!, std.id) ?? getStudentAverage(std.id);
                return (
                  <div key={std.id} className="flex items-center gap-3 rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-navy">{std.name}</p>
                      <p className="text-xs text-muted">
                        Avg: {avg !== null ? `${avg}%` : "No grades yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={scoreInputs[std.id] ?? ""}
                        onChange={(e) => setScoreInputs((prev) => ({ ...prev, [std.id]: e.target.value }))}
                        placeholder="Score"
                        className="w-24 rounded-lg border border-base bg-surface px-2 py-1.5 text-center text-sm text-navy outline-none focus:border-gold"
                      />
                      <span className="text-xs text-muted">/</span>
                      <input
                        type="number"
                        min="1"
                        value={maxInputs[std.id] ?? "100"}
                        onChange={(e) => setMaxInputs((prev) => ({ ...prev, [std.id]: e.target.value }))}
                        placeholder="out of"
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
              disabled={!activeSemester}
              className="mt-4 w-full rounded-full bg-gold py-3 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit grades
            </button>
            </div>
            )}
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Course leaderboard</p>
            <p className="mt-1 text-[11px] text-muted">Weighted average using this course&apos;s category weights.</p>
            <div className="mt-4 space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.student.id} className="flex items-center gap-3 rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
                  <p className="w-6 text-center text-xs font-bold text-muted">{i + 1}</p>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{entry.student.name}</p>
                  </div>
                  <p className="text-sm font-bold text-gold">{entry.avg > 0 ? `${entry.avg}%` : "-"}</p>
                  {(() => {
                    const r = entry.student.profileId ? rankOf(entry.student.profileId)?.current_rank ?? "D" : "D";
                    return (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r === "S++" || r === "EX" ? "bg-navy text-gold" :
                        r === "S" || r === "S+" ? "bg-gold text-on-accent" :
                        r === "A" ? "bg-blue-100 text-blue-700" :
                        r === "B" ? "bg-green-100 text-green-700" :
                        r === "C" ? "bg-muted/15 text-muted" :
                        "bg-red-100 text-red-600"
                      }`}>{r}</span>
                    );
                  })()}
                </div>
              ))}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
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
                            <p className="text-sm font-bold text-gold">
                              {e.score} / {e.maxScore} · {Math.round((e.score / Math.max(1, e.maxScore)) * 100)}%
                              <span className="ml-1 text-[10px] font-medium text-muted">({e.approvalStatus})</span>
                            </p>
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
