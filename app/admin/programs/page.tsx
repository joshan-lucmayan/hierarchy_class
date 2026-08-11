"use client";

import { useState } from "react";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchoolProfiles } from "@/lib/useSchoolProfiles";
import { CornerFrame } from "@/components/ui/CornerFrame";

type Step = "programs" | "sections" | "courses" | "students";

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
    getStudentsByCourse, addStudent, deleteStudent,
    getStudentAverage, getStudentRank,
  } = useClassroomHierarchy();

  const [step, setStep] = useState<Step>("programs");
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

  const [showEnrollPicker, setShowEnrollPicker] = useState(false);
  const [enrollQuery, setEnrollQuery] = useState("");

  const { profiles: signedUpStudents, loading: profilesLoading, error: profilesError } = useSchoolProfiles({ role: "student" });
  const { profiles: signedUpTeachers } = useSchoolProfiles({ role: "teacher" });

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
    if (editingProgramId) {
      updateProgram(editingProgramId, programDraft);
    } else {
      addProgram(programDraft);
    }
    setProgramDraft({ name: "", description: "" });
    setEditingProgramId(null);
    setShowProgramForm(false);
  }
  function handleDeleteProgram(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (confirm(`Delete "${name}"? This also removes its sections, courses, students, and grades.`)) {
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

  function handleEnroll(profileId: string, fullName: string) {
    if (!selectedCourse) return;
    addStudent({ courseId: selectedCourse, name: fullName, profileId });
  }
  function handleDeleteStudent(id: string, name: string) {
    if (confirm(`Remove "${name}" from this course? This also removes their grades for it.`)) {
      deleteStudent(id);
    }
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
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Programs & Curriculum</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Manage hierarchy</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Create, edit, and remove programs, sections, courses, and enrolled students.
        </p>
      </CornerFrame>

      {step === "programs" && (
        <div className="space-y-4">
          <button
            onClick={openProgramForm}
            className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:opacity-90"
          >
            {showProgramForm ? "Cancel" : "+ Add program"}
          </button>

          {showProgramForm && (
            <form onSubmit={handleProgramSubmit} className="space-y-2 rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
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
              <button type="submit" className="w-full rounded-lg bg-navy py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-navy">
                {editingProgramId ? "Save changes" : "Create"}
              </button>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((prog) => (
              <div
                key={prog.id}
                onClick={() => handleProgramSelect(prog.id)}
                className="cursor-pointer rounded-3xl border border-base bg-surface p-6 text-left shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-bold text-navy">{prog.name}</p>
                  <div className="flex shrink-0 gap-1.5">
                    <IconBtn onClick={(e) => startEditProgram(e, prog.id, prog.name, prog.description)} label="Edit program" variant="edit">✎</IconBtn>
                    <IconBtn onClick={(e) => handleDeleteProgram(e, prog.id, prog.name)} label="Delete program" variant="delete">✕</IconBtn>
                  </div>
                </div>
                {prog.description && <p className="mt-2 text-xs text-muted">{prog.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "sections" && (
        <div className="space-y-4">
          <button onClick={handleBack} className="text-sm font-semibold text-gold transition hover:text-gold/80">← Back</button>
          <button
            onClick={openSectionForm}
            className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:opacity-90"
          >
            {showSectionForm ? "Cancel" : "+ Add section"}
          </button>

          {showSectionForm && (
            <form onSubmit={handleSectionSubmit} className="space-y-2 rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
              <input
                value={sectionDraft}
                onChange={(e) => setSectionDraft(e.target.value)}
                placeholder="Section name (e.g., Grade 10, Year 1)"
                className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <button type="submit" className="w-full rounded-lg bg-navy py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-navy">
                {editingSectionId ? "Save changes" : "Create"}
              </button>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((sec) => (
              <div
                key={sec.id}
                onClick={() => handleSectionSelect(sec.id)}
                className="relative cursor-pointer rounded-3xl border-2 border-base bg-surface p-8 text-center shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="absolute right-3 top-3 flex gap-1.5">
                  <IconBtn onClick={(e) => startEditSection(e, sec.id, sec.name)} label="Edit section" variant="edit">✎</IconBtn>
                  <IconBtn onClick={(e) => handleDeleteSection(e, sec.id, sec.name)} label="Delete section" variant="delete">✕</IconBtn>
                </div>
                <p className="text-2xl font-bold text-navy">{sec.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "courses" && (
        <div className="space-y-4">
          <button onClick={handleBack} className="text-sm font-semibold text-gold transition hover:text-gold/80">← Back</button>
          <button
            onClick={openCourseForm}
            className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:opacity-90"
          >
            {showCourseForm ? "Cancel" : "+ Add course"}
          </button>

          {showCourseForm && (
            <form onSubmit={handleCourseSubmit} className="space-y-2 rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
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
              <button type="submit" className="w-full rounded-lg bg-navy py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-navy">
                {editingCourseId ? "Save changes" : "Create"}
              </button>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((crs) => (
              <div
                key={crs.id}
                onClick={() => handleCourseSelect(crs.id)}
                className="cursor-pointer rounded-3xl border border-base bg-surface p-6 text-left shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg"
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
          <button onClick={handleBack} className="text-sm font-semibold text-gold transition hover:text-gold/80">← Back</button>
          <button
            onClick={() => setShowEnrollPicker(!showEnrollPicker)}
            className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:opacity-90"
          >
            {showEnrollPicker ? "Cancel" : "+ Enroll student"}
          </button>

          {showEnrollPicker && (
            <CornerFrame className="rounded-2xl border border-base bg-[var(--surface-strong)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Signed-up students at your school</p>
              <input
                value={enrollQuery}
                onChange={(e) => setEnrollQuery(e.target.value)}
                placeholder="Search..."
                className="mt-2 w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {profilesLoading && <p className="text-sm text-muted">Loading roster...</p>}
                {profilesError && <p className="text-sm text-muted">{profilesError}</p>}
                {!profilesLoading && !profilesError && signedUpStudents
                  .filter((p) => !students.some((s) => s.profileId === p.id))
                  .filter((p) => p.full_name.toLowerCase().includes(enrollQuery.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleEnroll(p.id, p.full_name)}
                      className="flex w-full items-center justify-between rounded-lg border border-base bg-surface px-3 py-2 text-left text-sm text-navy transition hover:border-gold"
                    >
                      <span>{p.full_name}</span>
                      <span className="text-xs text-gold">+ Enroll</span>
                    </button>
                  ))}
                {!profilesLoading && !profilesError && signedUpStudents.filter((p) => !students.some((s) => s.profileId === p.id)).length === 0 && (
                  <p className="text-sm text-muted">All signed-up students are already enrolled in this course.</p>
                )}
              </div>
            </CornerFrame>
          )}

          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Students enrolled</p>
            <div className="mt-4 space-y-2">
              {students.length === 0 ? (
                <p className="text-sm text-muted">No students enrolled yet.</p>
              ) : (
                students.map((std) => {
                  const avg = getStudentAverage(std.id);
                  const rank = getStudentRank(std.id);
                  return (
                    <div key={std.id} className="flex items-center justify-between gap-3 rounded-2xl border border-base bg-[var(--surface-strong)] p-3">
                      <div>
                        <p className="text-sm font-semibold text-navy">{std.name}</p>
                        <p className="text-xs text-muted">{avg !== null ? `Avg ${avg}${rank ? ` · ${rank}` : ""}` : "No grades yet"}</p>
                      </div>
                      <IconBtn onClick={() => handleDeleteStudent(std.id, std.name)} label="Remove from course" variant="delete">✕</IconBtn>
                    </div>
                  );
                })
              )}
            </div>
          </CornerFrame>
        </div>
      )}
    </div>
  );
}
