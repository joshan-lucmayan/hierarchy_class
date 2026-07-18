"use client";

import { useMemo, useState } from "react";
import { LEARNING_MATERIALS } from "@/data/mockStudents";
import { LearningMaterial } from "@/types/student";

const SUBJECT_OPTIONS = ["Mathematics", "English", "Science", "PE"];
const GRADE_OPTIONS = ["9", "10"];

export default function TeacherLearningMaterialsPage() {
  const [materials, setMaterials] = useState<LearningMaterial[]>(LEARNING_MATERIALS);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [gradeLevel, setGradeLevel] = useState(GRADE_OPTIONS[0]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");

  const managedMaterials = useMemo(
    () => materials.filter((material) => material.uploadedBy === "Ms. Fernandez" || material.gradeLevel === Number(gradeLevel)),
    [materials, gradeLevel]
  );

  function handleAddMaterial() {
    if (!title.trim() || !fileName.trim()) {
      setMessage("Please enter a title and select a file.");
      return;
    }

    const nextMaterial: LearningMaterial = {
      id: `lm-${Date.now()}`,
      title: title.trim(),
      subject,
      gradeLevel: Number(gradeLevel),
      type: "Document",
      uploadedBy: "Ms. Fernandez",
      uploadDate: new Date().toISOString().slice(0, 10),
      description: `Uploaded resource for Grade ${gradeLevel} ${subject}.`,
      url: "#",
    };

    setMaterials((prev) => [nextMaterial, ...prev]);
    setTitle("");
    setFileName("");
    setMessage("Material added to your list.");
  }

  function handleDelete(id: string) {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-100 bg-white p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Teaching materials</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Upload new lessons</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Add a resource for your students and manage materials you have uploaded.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            <p className="font-semibold text-navy">Upload status</p>
            <p className="mt-2">{managedMaterials.length} materials visible</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 rounded-3xl border border-gray-100 bg-white p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lesson title"
                className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-navy outline-none focus:border-navy"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-700">
                Subject
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-navy outline-none focus:border-navy"
                >
                  {SUBJECT_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-700">
                Grade level
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-navy outline-none focus:border-navy"
                >
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>{`Grade ${grade}`}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">File</label>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3">
                <input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Choose a file name"
                  className="flex-1 rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-sm text-navy outline-none"
                />
                <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700">Browse</span>
              </div>
            </div>
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
            <button
              type="button"
              onClick={handleAddMaterial}
              className="inline-flex items-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Add material
            </button>
          </div>
        </div>

        <aside className="rounded-3xl border border-gray-100 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Manage uploads</p>
          <div className="mt-6 space-y-4">
            {managedMaterials.map((material) => (
              <div key={material.id} className="rounded-3xl border border-gray-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy">{material.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Grade {material.gradeLevel} · {material.subject}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(material.id)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-600">{material.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
