"use client";

import { useMemo, useState } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useRankStore } from "@/lib/rankStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { RankBadge } from "@/components/ui/RankBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  IconPlus,
  IconBack,
  IconPencil,
  IconTrash,
  IconCheck,
  IconChevronRight,
  IconUser,
  IconPost,
} from "@/components/ui/icons";

type Step = "levels" | "programs" | "sections" | "courses" | "students";

interface ConfirmTarget {
  kind: "level" | "program" | "section" | "course" | "student";
  id: string;
  name: string;
}

export default function AdminProgramsPage() {
  const {
    programs, addProgram, updateProgram, deleteProgram,
    getSectionsByProgram, addSection, updateSection, deleteSection,
    getCoursesBySection, addCourse, updateCourse, deleteCourse,
    getStudentsByCourse, deleteStudent,
    getStudentAverage,
    loading,
  } = useClassroomHierarchy();
  const { rankOf } = useRankStore();

  const [step, setStep] = useState<Step>("levels");
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const [showProgramForm, setShowProgramForm] = useState(false);
  const [programDraft, setProgramDraft] = useState({ name: "", description: "" });
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);

  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionDraft, setSectionDraft] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseDraft, setCourseDraft] = useState({ name: "", code: "", teacherId: "", teacherName: "" });
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const { profiles: signedUpTeachers } = useSchoolProfiles({ role: "teacher" });

  // Education levels are top-level programs (no parent); programs nest inside.
  const levels = programs.filter((p) => !p.parentId);
  const levelPrograms = selectedLevel ? programs.filter((p) => p.parentId === selectedLevel) : [];
  const selectedLevelName = levels.find((l) => l.id === selectedLevel)?.name ?? "";
  const selectedProgramName = levelPrograms.find((p) => p.id === selectedProgram)?.name ?? "";

  const sections = selectedProgram ? getSectionsByProgram(selectedProgram) : [];
  const courses = selectedSection ? getCoursesBySection(selectedSection) : [];
  const students = selectedCourse ? getStudentsByCourse(selectedCourse) : [];

  const selectedSectionName = sections.find((s) => s.id === selectedSection)?.name ?? "";
  const selectedCourseName = courses.find((c) => c.id === selectedCourse)?.name ?? "";

  // Hierarchy snapshot - all real counts derived from the live store.
  const snapshot = useMemo(() => {
    const allPrograms = programs.filter((p) => p.parentId);
    const allSections = allPrograms.flatMap((p) => getSectionsByProgram(p.id));
    const allCourses = allSections.flatMap((s) => getCoursesBySection(s.id));
    return {
      levels: levels.length,
      programs: allPrograms.length,
      sections: allSections.length,
      courses: allCourses.length,
    };
  }, [programs, getSectionsByProgram, getCoursesBySection, levels.length]);

  // Breadcrumb: where am I in the hierarchy?
  const crumbs: { label: string; step: Step }[] = [{ label: "Education levels", step: "levels" }];
  if (selectedLevel) crumbs.push({ label: selectedLevelName || "Programs", step: "programs" });
  if (selectedProgram) crumbs.push({ label: selectedProgramName || "Year levels", step: "sections" });
  if (selectedSection) crumbs.push({ label: selectedSectionName || "Courses", step: "courses" });
  if (selectedCourse) crumbs.push({ label: selectedCourseName || "Students", step: "students" });

  function jumpTo(target: Step) {
    if (target === "levels") {
      setSelectedLevel(null);
      setSelectedProgram(null);
      setSelectedSection(null);
      setSelectedCourse(null);
    } else if (target === "programs") {
      setSelectedProgram(null);
      setSelectedSection(null);
      setSelectedCourse(null);
    } else if (target === "sections") {
      setSelectedSection(null);
      setSelectedCourse(null);
    } else if (target === "courses") {
      setSelectedCourse(null);
    }
    setStep(target);
  }

  function openProgramForm() {
    setEditingProgramId(null);
    setProgramDraft({ name: "", description: "" });
    setShowProgramForm(!showProgramForm);
  }
  function startEditProgram(e: React.MouseEvent, id: string, name: string, description?: string) {
    e.stopPropagation();
    setEditingProgramId(id);
    setProgramDraft({ name, description: description ?? "" });
    setShowProgramForm(true);
  }
  function handleProgramSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!programDraft.name.trim()) return;
    // At the "levels" step this creates an education level (no parent); at the
    // "programs" step it creates a program nested under the selected level.
    const parentId = step === "levels" ? null : selectedLevel;
    if (editingProgramId) {
      updateProgram(editingProgramId, programDraft);
    } else {
      addProgram({ ...programDraft, parentId });
    }
    setProgramDraft({ name: "", description: "" });
    setEditingProgramId(null);
    setShowProgramForm(false);
  }
  function requestDelete(e: React.MouseEvent, kind: ConfirmTarget["kind"], id: string, name: string) {
    e.stopPropagation();
    setConfirmTarget({ kind, id, name });
  }
  function runDelete() {
    if (!confirmTarget) return;
    const { kind, id } = confirmTarget;
    if (kind === "level" || kind === "program") deleteProgram(id);
    else if (kind === "section") deleteSection(id);
    else if (kind === "course") deleteCourse(id);
    else deleteStudent(id);
    setConfirmTarget(null);
  }
  const confirmMessage = (() => {
    if (!confirmTarget) return "";
    switch (confirmTarget.kind) {
      case "level": return "This also removes its programs, sections, courses, students, and grades.";
      case "program": return "This also removes its sections, courses, students, and grades.";
      case "section": return "This also removes its courses, students, and grades.";
      case "course": return "This also removes its students and grades.";
      case "student": return "This also removes their grades for this course.";
    }
  })();

  function openSectionForm() {
    setEditingSectionId(null);
    setSectionDraft("");
    setShowSectionForm(!showSectionForm);
  }
  function startEditSection(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    setEditingSectionId(id);
    setSectionDraft(name);
    setShowSectionForm(true);
  }
  function handleSectionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionDraft.trim() || !selectedProgram) return;
    if (editingSectionId) {
      updateSection(editingSectionId, { programId: selectedProgram, name: sectionDraft });
    } else {
      addSection({ programId: selectedProgram, name: sectionDraft });
    }
    setSectionDraft("");
    setEditingSectionId(null);
    setShowSectionForm(false);
  }

  function openCourseForm() {
    setEditingCourseId(null);
    setCourseDraft({ name: "", code: "", teacherId: "", teacherName: "" });
    setShowCourseForm(!showCourseForm);
  }
  function startEditCourse(e: React.MouseEvent, id: string, name: string, code?: string, teacherId?: string, teacherName?: string) {
    e.stopPropagation();
    setEditingCourseId(id);
    setCourseDraft({ name, code: code ?? "", teacherId: teacherId ?? "", teacherName: teacherName ?? "" });
    setShowCourseForm(true);
  }
  function handleCourseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseDraft.name.trim() || !selectedSection) return;
    const payload = {
      sectionId: selectedSection,
      name: courseDraft.name,
      code: courseDraft.code,
      teacherId: courseDraft.teacherId || undefined,
      teacherName: courseDraft.teacherName || undefined,
    };
    if (editingCourseId) {
      updateCourse(editingCourseId, payload);
    } else {
      addCourse(payload);
    }
    setCourseDraft({ name: "", code: "", teacherId: "", teacherName: "" });
    setEditingCourseId(null);
    setShowCourseForm(false);
  }

  function handleLevelSelect(levelId: string) {
    setSelectedLevel(levelId);
    setSelectedProgram(null);
    setSelectedSection(null);
    setSelectedCourse(null);
    setStep("programs");
  }
  function handleProgramSelect(programId: string) {
    setSelectedProgram(programId);
    setSelectedSection(null);
    setSelectedCourse(null);
    setStep("sections");
  }
  function handleSectionSelect(sectionId: string) {
    setSelectedSection(sectionId);
    setSelectedCourse(null);
    setStep("courses");
  }
  function handleCourseSelect(courseId: string) {
    setSelectedCourse(courseId);
    setStep("students");
  }
  function handleBack() {
    if (step === "students") { setStep("courses"); setSelectedCourse(null); }
    else if (step === "courses") { setStep("sections"); setSelectedSection(null); }
    else if (step === "sections") { setStep("programs"); setSelectedProgram(null); }
    else if (step === "programs") { setStep("levels"); setSelectedLevel(null); }
  }

  const pageTitle =
    step === "levels" ? "Education levels"
    : step === "programs" ? selectedLevelName
    : step === "sections" ? selectedProgramName
    : step === "courses" ? selectedSectionName
    : selectedCourseName;

  const pageDesc =
    step === "levels"
      ? "Education levels are the top of the hierarchy. Open one to manage the programs inside it, their year/level sections, courses, and enrolled students."
      : step === "programs"
      ? `Programs under "${selectedLevelName}". Open one to manage its year/level sections.`
      : step === "sections"
      ? `Year / level sections under "${selectedProgramName}". Open one to manage its courses.`
      : step === "courses"
      ? "Courses under this year/level. Open one to enroll students."
      : "Students enrolled in this course.";

  const formEyebrow =
    step === "levels" ? (editingProgramId ? "Edit education level" : "New education level")
    : step === "programs" ? (editingProgramId ? "Edit program" : "New program")
    : step === "sections" ? (editingSectionId ? "Edit year / level" : "New year / level")
    : (editingCourseId ? "Edit course" : "New course");

  const formDesc =
    step === "levels" ? "Top of the hierarchy - programs, year levels, and courses live inside it."
    : step === "programs" ? `Nested under "${selectedLevelName}".`
    : step === "sections" ? `Year / level under "${selectedProgramName}".`
    : `Course under "${selectedSectionName}".`;

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* HEADER + BREADCRUMB                                        */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">{pageTitle}</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Hierarchy management
          </h2>
          <nav className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Hierarchy">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={c.step} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => jumpTo(c.step)}
                    disabled={isLast}
                    className={`font-mono-ui text-[10px] uppercase tracking-[0.18em] transition ${
                      isLast ? "text-navy" : "text-faint hover:text-accent-token"
                    }`}
                  >
                    {c.label}
                  </button>
                  {!isLast && <IconChevronRight size={10} className="text-faint" />}
                </span>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {step !== "levels" && (
            <Button variant="outline" size="sm" icon={<IconBack size={13} />} onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            variant="accent"
            size="sm"
            icon={showProgramForm || showSectionForm || showCourseForm ? undefined : <IconPlus size={13} />}
            onClick={() => {
              if (step === "sections") openSectionForm();
              else if (step === "courses") openCourseForm();
              else openProgramForm();
            }}
          >
            {showProgramForm || showSectionForm || showCourseForm
              ? "Cancel"
              : step === "levels" ? "Add education level"
              : step === "programs" ? "Add program"
              : step === "sections" ? "Add year / level"
              : "Add course"}
          </Button>
        </div>
      </div>

      <p className="max-w-2xl text-sm leading-6 text-muted">{pageDesc}</p>

      {/* ============================================================ */}
      {/* HIERARCHY SNAPSHOT                                         */}
      {/* ============================================================ */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Education levels" value={snapshot.levels} tone="default" />
        <Stat label="Programs" value={snapshot.programs} tone="accent" />
        <Stat label="Year levels" value={snapshot.sections} tone="default" />
        <Stat label="Courses" value={snapshot.courses} tone="default" />
      </section>

      {/* ============================================================ */}
      {/* MAIN MANAGEMENT AREA                                       */}
      {/* ============================================================ */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse rounded-[10px] border border-base bg-surface p-6">
              <div className="h-5 w-2/3 rounded-full bg-tile" />
              <div className="mt-3 h-3 w-full rounded-full bg-tile" />
              <div className="mt-4 h-4 w-24 rounded-full bg-tile" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ---------------- EDUCATION LEVELS ---------------- */}
          {step === "levels" && (
            <div className="space-y-4">
              {levels.length === 0 ? (
                <CornerFrame className="p-8">
                  <EmptyState
                    icon={<IconUser size={16} />}
                    title="No education levels"
                    desc="Education levels are the top of the hierarchy. Add one to start building programs, year levels, and courses."
                  />
                  <div className="mt-4 text-center">
                    <Button variant="accent" size="sm" icon={<IconPlus size={13} />} onClick={openProgramForm}>
                      Add education level
                    </Button>
                  </div>
                </CornerFrame>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {levels.map((level) => {
                    const programCount = programs.filter((p) => p.parentId === level.id).length;
                    return (
                      <div
                        key={level.id}
                        onClick={() => handleLevelSelect(level.id)}
                        className="group cursor-pointer rounded-[10px] border border-base bg-surface p-5 text-left transition hover:border-sealion"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-lg font-bold text-navy">{level.name}</p>
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              shape="square"
                              icon={<IconPencil size={12} />}
                              aria-label="Edit education level"
                              onClick={(e) => startEditProgram(e, level.id, level.name, level.description)}
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              shape="square"
                              icon={<IconTrash size={12} />}
                              aria-label="Delete education level"
                              onClick={(e) => requestDelete(e, "level", level.id, level.name)}
                            />
                          </div>
                        </div>
                        {level.description && <p className="mt-2 text-xs text-muted">{level.description}</p>}
                        <div className="mt-3 flex items-center justify-between">
                          <Chip variant="accent">{programCount} program{programCount === 1 ? "" : "s"} inside</Chip>
                          <IconChevronRight size={13} className="text-faint transition group-hover:text-accent-token" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------- PROGRAMS ---------------- */}
          {step === "programs" && (
            <div className="space-y-4">
              {levelPrograms.length === 0 ? (
                <CornerFrame className="p-8">
                  <EmptyState
                    icon={<IconPost size={16} />}
                    title="No programs"
                    desc={`No programs under "${selectedLevelName}" yet - add one to start building year levels and courses.`}
                  />
                  <div className="mt-4 text-center">
                    <Button variant="accent" size="sm" icon={<IconPlus size={13} />} onClick={openProgramForm}>
                      Add program
                    </Button>
                  </div>
                </CornerFrame>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {levelPrograms.map((prog) => {
                    const sectionCount = getSectionsByProgram(prog.id).length;
                    return (
                      <div
                        key={prog.id}
                        onClick={() => handleProgramSelect(prog.id)}
                        className="group cursor-pointer rounded-[10px] border border-base bg-surface p-5 text-left transition hover:border-sealion"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-lg font-bold text-navy">{prog.name}</p>
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              shape="square"
                              icon={<IconPencil size={12} />}
                              aria-label="Edit program"
                              onClick={(e) => startEditProgram(e, prog.id, prog.name, prog.description)}
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              shape="square"
                              icon={<IconTrash size={12} />}
                              aria-label="Delete program"
                              onClick={(e) => requestDelete(e, "program", prog.id, prog.name)}
                            />
                          </div>
                        </div>
                        {prog.description && <p className="mt-2 text-xs text-muted">{prog.description}</p>}
                        <div className="mt-3 flex items-center justify-between">
                          <Chip variant="accent">{sectionCount} year/level{sectionCount === 1 ? "" : "s"} inside</Chip>
                          <IconChevronRight size={13} className="text-faint transition group-hover:text-accent-token" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------- YEAR LEVELS ---------------- */}
          {step === "sections" && (
            <div className="space-y-4">
              {sections.length === 0 ? (
                <CornerFrame className="p-8">
                  <EmptyState
                    icon={<IconPost size={16} />}
                    title="No year levels"
                    desc={`No year / level sections under "${selectedProgramName}" yet - add one to start building courses.`}
                  />
                  <div className="mt-4 text-center">
                    <Button variant="accent" size="sm" icon={<IconPlus size={13} />} onClick={openSectionForm}>
                      Add year / level
                    </Button>
                  </div>
                </CornerFrame>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.map((sec) => (
                    <div
                      key={sec.id}
                      onClick={() => handleSectionSelect(sec.id)}
                      className="group relative cursor-pointer rounded-[10px] border border-base bg-surface p-6 text-center transition hover:border-sealion"
                    >
                      <div className="absolute right-3 top-3 flex gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          icon={<IconPencil size={12} />}
                          aria-label="Edit year / level"
                          onClick={(e) => startEditSection(e, sec.id, sec.name)}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          shape="square"
                          icon={<IconTrash size={12} />}
                          aria-label="Delete year / level"
                          onClick={(e) => requestDelete(e, "section", sec.id, sec.name)}
                        />
                      </div>
                      <p className="text-2xl font-bold text-navy">{sec.name}</p>
                      <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-faint">
                        Open year level <IconChevronRight size={11} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------- COURSES ---------------- */}
          {step === "courses" && (
            <div className="space-y-4">
              {courses.length === 0 ? (
                <CornerFrame className="p-8">
                  <EmptyState
                    icon={<IconPost size={16} />}
                    title="No courses"
                    desc={`No courses in this year / level yet - add one to start enrolling students.`}
                  />
                  <div className="mt-4 text-center">
                    <Button variant="accent" size="sm" icon={<IconPlus size={13} />} onClick={openCourseForm}>
                      Add course
                    </Button>
                  </div>
                </CornerFrame>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((crs) => (
                    <div
                      key={crs.id}
                      onClick={() => handleCourseSelect(crs.id)}
                      className="group cursor-pointer rounded-[10px] border border-base bg-surface p-5 text-left transition hover:border-sealion"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-lg font-bold text-navy">{crs.name}</p>
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            shape="square"
                            icon={<IconPencil size={12} />}
                            aria-label="Edit course"
                            onClick={(e) => startEditCourse(e, crs.id, crs.name, crs.code, crs.teacherId, crs.teacherName)}
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            shape="square"
                            icon={<IconTrash size={12} />}
                            aria-label="Delete course"
                            onClick={(e) => requestDelete(e, "course", crs.id, crs.name)}
                          />
                        </div>
                      </div>
                      {crs.code && <p className="mt-2 text-xs text-muted">{crs.code}</p>}
                      <div className="mt-3 flex items-center justify-between">
                        <Chip variant={crs.teacherName ? "success" : "neutral"}>
                          {crs.teacherName ? `Taught by ${crs.teacherName}` : "No teacher assigned"}
                        </Chip>
                        <IconChevronRight size={13} className="text-faint transition group-hover:text-accent-token" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------- STUDENTS ---------------- */}
          {step === "students" && (
            <CornerFrame className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="section-label">Students in this course</h3>
                <Chip variant="neutral">{students.length} enrolled</Chip>
              </div>
              {students.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={<IconUser size={16} />}
                    title="No students here yet"
                    desc="Enroll them from Admin > Students - picking their education level, program, and year/level in Academic info automatically gives them access to this course's classes."
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {students.map((s) => {
                    const avg = s.profileId ? getStudentAverage(s.profileId) : null;
                    const rank = s.profileId ? rankOf(s.profileId)?.current_rank ?? "D" : "D";
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-[10px] border border-base bg-surface px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar name={s.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-navy">{s.name}</p>
                            <p className="text-[11px] text-muted">
                              {avg !== null ? `Average ${avg}` : "No grades yet"}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {s.profileId && <RankBadge rank={rank} size="sm" />}
                          <Button
                            variant="danger"
                            size="sm"
                            shape="square"
                            icon={<IconTrash size={12} />}
                            aria-label={`Remove ${s.name}`}
                            onClick={(e) => requestDelete(e, "student", s.id, s.name)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CornerFrame>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* CREATE / EDIT MODALS                                       */}
      {/* ============================================================ */}
      {(step === "levels" || step === "programs") && showProgramForm && (
        <Modal onClose={() => setShowProgramForm(false)} eyebrow={formEyebrow} description={formDesc}>
          <form onSubmit={handleProgramSubmit} className="space-y-2.5">
            <input
              value={programDraft.name}
              onChange={(e) => setProgramDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder={step === "levels" ? "Education level name" : "Program name"}
              className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
            />
            <input
              value={programDraft.description}
              onChange={(e) => setProgramDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" icon={editingProgramId ? <IconCheck size={13} /> : <IconPlus size={13} />}>
                {editingProgramId ? "Save changes" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setShowProgramForm(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {step === "sections" && showSectionForm && (
        <Modal onClose={() => setShowSectionForm(false)} eyebrow={formEyebrow} description={formDesc}>
          <form onSubmit={handleSectionSubmit} className="space-y-2.5">
            <input
              value={sectionDraft}
              onChange={(e) => setSectionDraft(e.target.value)}
              placeholder="Year / level name"
              className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" icon={editingSectionId ? <IconCheck size={13} /> : <IconPlus size={13} />}>
                {editingSectionId ? "Save changes" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setShowSectionForm(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {step === "courses" && showCourseForm && (
        <Modal onClose={() => setShowCourseForm(false)} eyebrow={formEyebrow} description={formDesc}>
          <form onSubmit={handleCourseSubmit} className="space-y-2.5">
            <input
              value={courseDraft.name}
              onChange={(e) => setCourseDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Course name"
              className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
            />
            <input
              value={courseDraft.code}
              onChange={(e) => setCourseDraft((d) => ({ ...d, code: e.target.value }))}
              placeholder="Course code (optional)"
              className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
            />
            <select
              value={courseDraft.teacherId}
              onChange={(e) => {
                const t = signedUpTeachers.find((p) => p.id === e.target.value);
                setCourseDraft((d) => ({ ...d, teacherId: e.target.value, teacherName: t?.full_name ?? "" }));
              }}
              className="w-full rounded-[8px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
            >
              <option value="">Assign teacher (optional)</option>
              {signedUpTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" icon={editingCourseId ? <IconCheck size={13} /> : <IconPlus size={13} />}>
                {editingCourseId ? "Save changes" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setShowCourseForm(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* DELETE CONFIRMATION                                        */}
      {/* ============================================================ */}
      {confirmTarget && (
        <Modal
          onClose={() => setConfirmTarget(null)}
          eyebrow="Confirm delete"
          description={`Delete "${confirmTarget.name}"?`}
          maxWidth="max-w-sm"
        >
          <p className="text-sm leading-6 text-muted">{confirmMessage}</p>
          <div className="mt-5 flex gap-2">
            <Button variant="danger" icon={<IconTrash size={13} />} onClick={runDelete}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
