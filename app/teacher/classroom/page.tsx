"use client";

import { useEffect, useMemo, useState } from "react";
import { useClassroomHierarchy, CourseCategory } from "@/lib/classroomHierarchyStore";
import { useRankStore } from "@/lib/rankStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RankBadge } from "@/components/ui/RankBadge";
import { IconBack, IconChevronRight, IconPlus, IconX, IconCheck, IconTask, IconUser } from "@/components/ui/icons";

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

  const selectedProgramName = selectedProgram
    ? (programs.find((p) => p.id === selectedProgram)?.name ?? null)
    : null;
  const selectedSectionName = selectedSection
    ? (sections.find((s) => s.id === selectedSection)?.name ?? null)
    : null;
  const selectedCourseName = selectedCourse
    ? (myCourses.find((c) => c.id === selectedCourse)?.name ?? null)
    : null;
  const breadcrumb = [selectedProgramName, selectedSectionName, selectedCourseName]
    .filter(Boolean)
    .join(" · ");

  if (!profile) {
    return (
      <div className="space-y-4">
        <CornerFrame className="p-5">
          <div className="flex animate-pulse items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-tile" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-48 rounded-full bg-tile" />
              <div className="h-2.5 w-32 rounded-full bg-tile" />
            </div>
          </div>
          <div className="mt-4 grid animate-pulse gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-[10px] bg-tile" />
            ))}
          </div>
        </CornerFrame>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Grade submission</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Classroom · configure categories, enter scores, submit for approval
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {activeSemester && (
            <Chip variant="gold">
              {activeSemester.school_year} · {activeSemester.semester_label}
            </Chip>
          )}
          <Stat label="My courses" value={myCourses.length} tone="gold" hint="Assigned to you" />
        </div>
      </div>

      {step === "programs" && (
        <div className="space-y-3">
          <h3 className="section-label">Select program</h3>
          {myPrograms.length === 0 ? (
            <CornerFrame className="p-8">
              <EmptyState
                icon={<IconTask size={16} />}
                title="No courses assigned"
                desc="No courses have been assigned to you yet. Contact your admin to get your classroom set up."
              />
            </CornerFrame>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myPrograms.map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => { setSelectedProgram(prog.id); setStep("sections"); }}
                  className="group flex items-start justify-between gap-3 rounded-[10px] border border-base bg-surface p-5 text-left transition hover:border-gold-soft"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-navy">{prog.name}</p>
                    {prog.description && <p className="mt-1.5 text-xs text-muted">{prog.description}</p>}
                  </div>
                  <IconChevronRight size={14} className="mt-1 shrink-0 text-faint transition group-hover:text-gold-token" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "sections" && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" icon={<IconBack size={13} />} onClick={handleBack}>
            Back
          </Button>
          <h3 className="section-label">Select section</h3>
          {breadcrumb && <p className="font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">{breadcrumb}</p>}
          {sectionsForProgram.length === 0 ? (
            <CornerFrame className="p-8">
              <EmptyState
                icon={<IconUser size={16} />}
                title="No sections here"
                desc="You don't teach any section under this program yet."
              />
            </CornerFrame>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sectionsForProgram.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => { setSelectedSection(sec.id); setStep("courses"); }}
                  className="flex items-center justify-center rounded-[10px] border border-base bg-surface p-8 text-center transition hover:border-gold-soft"
                >
                  <p className="text-2xl font-bold text-navy">{sec.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "courses" && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" icon={<IconBack size={13} />} onClick={handleBack}>
            Back
          </Button>
          <h3 className="section-label">Select course</h3>
          {breadcrumb && <p className="font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">{breadcrumb}</p>}
          {coursesForSection.length === 0 ? (
            <CornerFrame className="p-8">
              <EmptyState
                icon={<IconTask size={16} />}
                title="No courses here"
                desc="You don't teach any course in this section yet."
              />
            </CornerFrame>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coursesForSection.map((crs) => (
                <button
                  key={crs.id}
                  onClick={() => { setSelectedCourse(crs.id); setStep("students"); setSubmitted(false); }}
                  className="group flex items-start justify-between gap-3 rounded-[10px] border border-base bg-surface p-5 text-left transition hover:border-gold-soft"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-navy">{crs.name}</p>
                    {crs.code && <p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[0.15em] text-muted">{crs.code}</p>}
                  </div>
                  <IconChevronRight size={14} className="mt-1 shrink-0 text-faint transition group-hover:text-gold-token" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "students" && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" icon={<IconBack size={13} />} onClick={handleBack}>
            Back
          </Button>
          {breadcrumb && <p className="font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">{breadcrumb}</p>}

          {/* Category editor - add / remove / edit per course */}
          <CornerFrame className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-label">Course categories</h3>
              <Chip variant={Math.abs(weightsTotal - 100) > 0.01 ? "warn" : "gold"}>
                Total: {weightsTotal}%
              </Chip>
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
                    className="flex-1 rounded-[8px] border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={c.weight}
                      onChange={(e) => updateDraft(i, { weight: e.target.value })}
                      className="w-20 rounded-[8px] border border-base bg-[var(--surface-strong)] px-3 py-2 text-right text-sm text-navy outline-none focus:border-gold"
                    />
                    <span className="text-xs text-muted">%</span>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    shape="square"
                    icon={<IconX size={13} />}
                    title="Remove category"
                    onClick={() => removeDraft(i)}
                    className="!px-2.5"
                  >
                    <span className="sr-only">Remove category</span>
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                icon={<IconPlus size={13} />}
                onClick={() => setCategoryDrafts((prev) => [...prev, { key: "", label: "", weight: "0" }])}
              >
                Add category
              </Button>
              <Button
                variant="gold"
                size="sm"
                icon={<IconCheck size={13} />}
                onClick={handleSaveWeights}
              >
                Save categories
              </Button>
              {weightsMsg && (
                <p className={`text-xs ${weightsMsg.kind === "ok" ? "text-gold-token" : "text-warn"}`}>{weightsMsg.text}</p>
              )}
            </div>
          </CornerFrame>

          {/* Submit grades */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Submit grades</h3>

            {!activeSemester && (
              <div className="mt-4 rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3">
                <p className="text-sm font-semibold text-warn">The semester hasn&apos;t started yet.</p>
                <p className="mt-1 text-sm text-muted">
                  Grades can&apos;t be submitted until the admin starts the semester. Contact your
                  admin - they can declare it from the Admin &gt; Ranks page.
                </p>
              </div>
            )}

            {submitted && (
              <div className="mt-3 rounded-[10px] border border-gold-soft bg-gold-soft px-4 py-2">
                <p className="text-sm font-semibold text-gold-token">Grades submitted and sent for admin approval.</p>
              </div>
            )}
            {submitError && (
              <div className="mt-3 rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-2">
                <p className="text-sm font-semibold text-warn">{submitError}</p>
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
                    <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Category</p>
                    <div className="flex flex-wrap gap-2">
                      {categoryDrafts.map((c) => (
                        <button
                          key={c.key || c.label}
                          type="button"
                          onClick={() => setGradeType(c.label)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            gradeType === c.label
                              ? "bg-gold-token text-on-accent"
                              : "border border-base text-muted hover:border-gold-soft hover:text-gold-token"
                          }`}
                        >
                          {c.label || "Untitled"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Label (optional)</p>
                    <input
                      value={gradeLabel}
                      onChange={(e) => setGradeLabel(e.target.value)}
                      placeholder={`e.g. ${gradeType} 1`}
                      className="w-full rounded-[8px] border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">Date</p>
                    <input
                      type="date"
                      value={gradeDate}
                      onChange={(e) => setGradeDate(e.target.value)}
                      className="w-full rounded-[8px] border border-base bg-[var(--surface-strong)] px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {students.length === 0 ? (
                    <div className="py-4">
                      <EmptyState
                        icon={<IconUser size={16} />}
                        title="No students enrolled"
                        desc="Students appear here once they're enrolled in this course."
                      />
                    </div>
                  ) : (
                    students.map((std) => {
                      const avg = getCourseWeightedAverage(selectedCourse!, std.id) ?? getStudentAverage(std.id);
                      return (
                        <div key={std.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
                          <UserAvatar name={std.name} size="sm" profileId={std.profileId} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-navy">{std.name}</p>
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
                              className="w-24 rounded-[8px] border border-base bg-surface px-2 py-1.5 text-center text-sm text-navy outline-none focus:border-gold"
                            />
                            <span className="text-xs text-muted">/</span>
                            <input
                              type="number"
                              min="1"
                              value={maxInputs[std.id] ?? "100"}
                              onChange={(e) => setMaxInputs((prev) => ({ ...prev, [std.id]: e.target.value }))}
                              placeholder="out of"
                              className="w-20 rounded-[8px] border border-base bg-surface px-2 py-1.5 text-center text-sm text-navy outline-none focus:border-gold"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <Button
                  type="button"
                  variant="gold"
                  size="lg"
                  className="w-full"
                  onClick={handleSubmitGrades}
                  disabled={!activeSemester}
                >
                  Submit grades
                </Button>
              </div>
            )}
          </CornerFrame>

          {/* Course leaderboard */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Course leaderboard</h3>
            <p className="mt-1 text-[11px] text-muted">Weighted average using this course&apos;s category weights.</p>
            <div className="mt-4 space-y-2">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted">No graded students yet.</p>
              ) : (
                leaderboard.map((entry, i) => (
                  <div key={entry.student.id} className="flex items-center gap-3 rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
                    <p className="w-6 shrink-0 text-center font-mono-ui text-xs font-bold text-faint">{i + 1}</p>
                    <UserAvatar name={entry.student.name} size="sm" profileId={entry.student.profileId} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{entry.student.name}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-gold-token">
                      {entry.avg > 0 ? `${entry.avg}%` : "-"}
                    </p>
                    <RankBadge
                      rank={entry.student.profileId ? rankOf(entry.student.profileId)?.current_rank ?? "D" : "D"}
                      size="sm"
                    />
                  </div>
                ))
              )}
            </div>
          </CornerFrame>

          {/* Grade history */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Grade history</h3>
            <div className="mt-4 space-y-4">
              {students.map((std) => {
                const entries = getEntriesByStudent(std.id).sort((a, b) => b.date.localeCompare(a.date));
                return (
                  <div key={std.id}>
                    <p className="text-sm font-bold text-navy">{std.name}</p>
                    {entries.length === 0 ? (
                      <p className="mt-1 text-xs text-muted">No entries yet.</p>
                    ) : (
                      <div className="mt-1.5 space-y-1">
                        {entries.map((e) => (
                          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-base px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip variant="neutral">{e.type}</Chip>
                              <p className="text-xs text-navy">{e.label}</p>
                              <p className="font-mono-ui text-[10px] text-muted">{e.date}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gold-token">
                                {e.score} / {e.maxScore} · {Math.round((e.score / Math.max(1, e.maxScore)) * 100)}%
                              </p>
                              <Chip
                                variant={
                                  e.approvalStatus === "approved"
                                    ? "success"
                                    : e.approvalStatus === "pending"
                                      ? "warn"
                                      : e.approvalStatus === "rejected"
                                        ? "danger"
                                        : "neutral"
                                }
                              >
                                {e.approvalStatus}
                              </Chip>
                            </div>
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
