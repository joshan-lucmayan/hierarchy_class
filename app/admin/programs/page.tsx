"use client";

import { useState } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ActionButton, PlusIcon, MinusIcon, CheckIcon, BackIcon } from "@/components/ui/ActionButton";

type Step = "levels" | "programs" | "sections" | "courses" | "students";

function IconBtn({ onClick, label, variant, children }: { onClick: (e: React.MouseEvent) => void; label: string; variant: "edit" | "delete"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition ${
        variant === "delete"
          ? "border-base text-muted hover:border-red-400 hover:text-red-600"
          : "border-base text-muted hover:border-gold hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}

export default function AdminProgramsPage() {
  const {
    programs, addProgram, updateProgram, deleteProgram,
    getSectionsByProgram, addSection, updateSection, deleteSection,
    getCoursesBySection, addCourse, updateCourse, deleteCourse,
    getStudentsByCourse, deleteStudent,
    getStudentAverage, getStudentRank,
  } = useClassroomHierarchy();

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

  const { profiles: signedUpTeachers } = useSchoolProfiles({ role: "teacher" });

  // Education levels are top-level programs (no parent); programs nest inside.
  const levels = programs.filter((p) => !p.parentId);
  const levelPrograms = selectedLevel ? programs.filter((p) => p.parentId === selectedLevel) : [];
  const selectedLevelName = levels.find((l) => l.id === selectedLevel)?.name ?? "";
  const selectedProgramName = levelPrograms.find((p) => p.id === selectedProgram)?.name ?? "";

  const sections = selectedProgram ? getSectionsByProgram(selectedProgram) : [];
  const courses = selectedSection ? getCoursesBySection(selectedSection) : [];
  const students = selectedCourse ? getStudentsByCourse(selectedCourse) : [];

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
  function handleDeleteProgram(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (confirm(`Delete "${name}"? This also removes its programs, sections, courses, students, and grades.`)) {
      deleteProgram(id);
    }
  }

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
  function handleDeleteSection(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (confirm(`Delete "${name}"? This also removes its courses, students, and grades.`)) {
      deleteSection(id);
    }
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
  function handleDeleteCourse(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (confirm(`Delete "${name}"? This also removes its students and grades.`)) {
      deleteCourse(id);
    }
  }

  function handleDeleteStudent(id: string, name: string) {
    if (confirm(`Remove "${name}" from this course? This also removes their grades for it.`)) {
      deleteStudent(id);
    }
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

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Education Level Management</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">
          {step === "levels" ? "Education levels" : selectedLevelName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          {step === "levels"
            ? "Education levels are the top of the hierarchy. Open one to manage the programs inside it, their year/level sections, courses, and enrolled students."
            : step === "programs"
            ? `Programs under "${selectedLevelName}". Open one to manage its year/level sections.`
            : step === "sections"
            ? `Year / level sections under "${selectedProgramName}". Open one to manage its courses.`
            : step === "courses"
            ? "Courses under this year/level. Open one to enroll students."
            : "Students enrolled in this course."}
        </p>
      </CornerFrame>

      {step === "levels" && (
        <div className="space-y-4">
          <ActionButton
            onClick={openProgramForm}
            variant={showProgramForm ? "neutral" : "gold"}
            icon={showProgramForm ? <MinusIcon /> : <PlusIcon />}
          >
            {showProgramForm ? "Cancel" : "Add education level"}
          </ActionButton>

          {showProgramForm && (
            <form onSubmit={handleProgramSubmit} className="space-y-2 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
              <input
                value={programDraft.name}
                onChange={(e) => setProgramDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Education level name"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <input
                value={programDraft.description}
                onChange={(e) => setProgramDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <ActionButton type="submit" variant="navy" icon={editingProgramId ? <CheckIcon /> : <PlusIcon size={12} />} className="w-full justify-center">
                {editingProgramId ? "Save changes" : "Create"}
              </ActionButton>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levels.length === 0 && (
              <p className="text-sm text-muted">No education levels yet - add one to get started.</p>
            )}
            {levels.map((level) => {
              const programCount = programs.filter((p) => p.parentId === level.id).length;
              return (
                <div
                  key={level.id}
                  onClick={() => handleLevelSelect(level.id)}
                  className="cursor-pointer rounded-[10px] border border-base bg-surface p-6 text-left transition hover:border-sealion"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-bold text-navy">{level.name}</p>
                    <div className="flex shrink-0 gap-1.5">
                      <IconBtn onClick={(e) => startEditProgram(e, level.id, level.name, level.description)} label="Edit education level" variant="edit">✎</IconBtn>
                      <IconBtn onClick={(e) => handleDeleteProgram(e, level.id, level.name)} label="Delete education level" variant="delete">✕</IconBtn>
                    </div>
                  </div>
                  {level.description && <p className="mt-2 text-xs text-muted">{level.description}</p>}
                  <p className="mt-3 text-xs font-semibold text-gold">
                    {programCount} program{programCount === 1 ? "" : "s"} inside
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === "programs" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ActionButton variant="neutral" icon={<BackIcon />} onClick={handleBack}>Back</ActionButton>
            <ActionButton
              onClick={openProgramForm}
              variant={showProgramForm ? "neutral" : "gold"}
              icon={showProgramForm ? <MinusIcon /> : <PlusIcon />}
            >
              {showProgramForm ? "Cancel" : "Add program"}
            </ActionButton>
          </div>

          {showProgramForm && (
            <form onSubmit={handleProgramSubmit} className="space-y-2 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
              <input
                value={programDraft.name}
                onChange={(e) => setProgramDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Program name"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <input
                value={programDraft.description}
                onChange={(e) => setProgramDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <ActionButton type="submit" variant="navy" icon={editingProgramId ? <CheckIcon /> : <PlusIcon size={12} />} className="w-full justify-center">
                {editingProgramId ? "Save changes" : "Create"}
              </ActionButton>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levelPrograms.length === 0 && (
              <p className="text-sm text-muted">No programs under {selectedLevelName} yet - add one to get started.</p>
            )}
            {levelPrograms.map((prog) => {
              const sectionCount = getSectionsByProgram(prog.id).length;
              return (
                <div
                  key={prog.id}
                  onClick={() => handleProgramSelect(prog.id)}
                  className="cursor-pointer rounded-[10px] border border-base bg-surface p-6 text-left transition hover:border-sealion"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-bold text-navy">{prog.name}</p>
                    <div className="flex shrink-0 gap-1.5">
                      <IconBtn onClick={(e) => startEditProgram(e, prog.id, prog.name, prog.description)} label="Edit program" variant="edit">✎</IconBtn>
                      <IconBtn onClick={(e) => handleDeleteProgram(e, prog.id, prog.name)} label="Delete program" variant="delete">✕</IconBtn>
                    </div>
                  </div>
                  {prog.description && <p className="mt-2 text-xs text-muted">{prog.description}</p>}
                  <p className="mt-3 text-xs font-semibold text-gold">
                    {sectionCount} year/level{sectionCount === 1 ? "" : "s"} inside
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === "sections" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ActionButton variant="neutral" icon={<BackIcon />} onClick={handleBack}>Back</ActionButton>
            <ActionButton
              onClick={openSectionForm}
              variant={showSectionForm ? "neutral" : "gold"}
              icon={showSectionForm ? <MinusIcon /> : <PlusIcon />}
            >
              {showSectionForm ? "Cancel" : "Add year / level"}
            </ActionButton>
          </div>

          {showSectionForm && (
            <form onSubmit={handleSectionSubmit} className="space-y-2 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
              <input
                value={sectionDraft}
                onChange={(e) => setSectionDraft(e.target.value)}
                placeholder="Year / level name"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <ActionButton type="submit" variant="navy" icon={editingSectionId ? <CheckIcon /> : <PlusIcon size={12} />} className="w-full justify-center">
                {editingSectionId ? "Save changes" : "Create"}
              </ActionButton>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.length === 0 && (
              <p className="text-sm text-muted">No year/levels under {selectedProgramName} yet.</p>
            )}
            {sections.map((sec) => (
              <div
                key={sec.id}
                onClick={() => handleSectionSelect(sec.id)}
                className="relative cursor-pointer rounded-[10px] border border-base bg-surface p-8 text-center transition hover:border-sealion"
              >
                <div className="absolute right-3 top-3 flex gap-1.5">
                  <IconBtn onClick={(e) => startEditSection(e, sec.id, sec.name)} label="Edit year/level" variant="edit">✎</IconBtn>
                  <IconBtn onClick={(e) => handleDeleteSection(e, sec.id, sec.name)} label="Delete year/level" variant="delete">✕</IconBtn>
                </div>
                <p className="text-2xl font-bold text-navy">{sec.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "courses" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ActionButton variant="neutral" icon={<BackIcon />} onClick={handleBack}>Back</ActionButton>
            <ActionButton
              onClick={openCourseForm}
              variant={showCourseForm ? "neutral" : "gold"}
              icon={showCourseForm ? <MinusIcon /> : <PlusIcon />}
            >
              {showCourseForm ? "Cancel" : "Add course"}
            </ActionButton>
          </div>

          {showCourseForm && (
            <form onSubmit={handleCourseSubmit} className="space-y-2 rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
              <input
                value={courseDraft.name}
                onChange={(e) => setCourseDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Course name"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <input
                value={courseDraft.code}
                onChange={(e) => setCourseDraft((d) => ({ ...d, code: e.target.value }))}
                placeholder="Course code (optional)"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <select
                value={courseDraft.teacherId}
                onChange={(e) => {
                  const t = signedUpTeachers.find((p) => p.id === e.target.value);
                  setCourseDraft((d) => ({ ...d, teacherId: e.target.value, teacherName: t?.full_name ?? "" }));
                }}
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              >
                <option value="">Assign teacher (optional)</option>
                {signedUpTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
              <ActionButton type="submit" variant="navy" icon={editingCourseId ? <CheckIcon /> : <PlusIcon size={12} />} className="w-full justify-center">
                {editingCourseId ? "Save changes" : "Create"}
              </ActionButton>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.length === 0 && (
              <p className="text-sm text-muted">No courses in this year/level yet.</p>
            )}
            {courses.map((crs) => (
              <div
                key={crs.id}
                onClick={() => handleCourseSelect(crs.id)}
                className="cursor-pointer rounded-[10px] border border-base bg-surface p-6 text-left transition hover:border-sealion"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-bold text-navy">{crs.name}</p>
                  <div className="flex shrink-0 gap-1.5">
                    <IconBtn onClick={(e) => startEditCourse(e, crs.id, crs.name, crs.code, crs.teacherId, crs.teacherName)} label="Edit course" variant="edit">✎</IconBtn>
                    <IconBtn onClick={(e) => handleDeleteCourse(e, crs.id, crs.name)} label="Delete course" variant="delete">✕</IconBtn>
                  </div>
                </div>
                {crs.code && <p className="mt-2 text-xs text-muted">{crs.code}</p>}
                <p className="mt-1 text-xs text-gold">{crs.teacherName ? `Taught by ${crs.teacherName}` : "No teacher assigned"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "students" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ActionButton variant="neutral" icon={<BackIcon />} onClick={handleBack}>Back</ActionButton>
          </div>

          <CornerFrame className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Students in this course</p>
            {students.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No students here yet. Enroll them from Admin &gt; Students - picking their education level, program,
                and year/level in Academic info automatically gives them access to this course&apos;s classes.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {students.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-base bg-surface px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-navy">{s.name}</p>
                      {s.profileId && (
                        <p className="text-xs text-muted">
                          {getStudentAverage(s.profileId) !== null ? `Average ${getStudentAverage(s.profileId)}` : "No grades yet"}
                          {getStudentRank(s.profileId) ? ` · Rank ${getStudentRank(s.profileId)}` : ""}
                        </p>
                      )}
                    </div>
                    <IconBtn onClick={(e) => { e.stopPropagation(); handleDeleteStudent(s.id, s.name); }} label="Remove student" variant="delete">✕</IconBtn>
                  </div>
                ))}
              </div>
            )}
          </CornerFrame>
        </div>
      )}
    </div>
  );
}
