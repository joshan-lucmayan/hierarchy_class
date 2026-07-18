"use client";

import { useMemo, useState } from "react";
import { LEARNING_MATERIALS } from "@/data/mockStudents";
import { LearningMaterial } from "@/types/student";

const SUBJECT_OPTIONS = ["All", "Mathematics", "English", "Science", "PE"];
const GRADE_OPTIONS = ["All", "9", "10"];

export default function LearningMaterialsPage() {
  const [subjectFilter, setSubjectFilter] = useState(SUBJECT_OPTIONS[0]);
  const [gradeFilter, setGradeFilter] = useState(GRADE_OPTIONS[0]);
  const [openId, setOpenId] = useState<string | null>(null);

  const materials = useMemo(
    () =>
      LEARNING_MATERIALS.filter((material) => {
        const subjectMatch = subjectFilter === "All" || material.subject === subjectFilter;
        const gradeMatch = gradeFilter === "All" || String(material.gradeLevel) === gradeFilter;
        return subjectMatch && gradeMatch;
      }),
    [subjectFilter, gradeFilter]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-base bg-surface p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Learning Materials</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Browse resources</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Filter by grade level and subject to find the resources your teachers uploaded.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-2xl border border-base bg-surface px-4 py-3 text-sm font-semibold text-navy outline-none focus:border-navy"
            >
              {SUBJECT_OPTIONS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="rounded-2xl border border-base bg-surface px-4 py-3 text-sm font-semibold text-navy outline-none focus:border-navy"
            >
              {GRADE_OPTIONS.map((grade) => (
                <option key={grade} value={grade}>{grade === "All" ? "All grades" : `Grade ${grade}`}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {materials.length === 0 ? (
        <section className="rounded-3xl border border-base bg-surface p-6 text-muted">
          No matching learning materials found. Try a different grade or subject filter.
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {materials.map((material: LearningMaterial) => (
            <article key={material.id} className="rounded-3xl border border-base bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted">{material.subject}</p>
                  <h2 className="mt-3 text-lg font-semibold text-navy">{material.title}</h2>
                </div>
                <span className="rounded-full border border-base bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-muted">
                  {material.type}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">{material.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted">
                <span>Grade {material.gradeLevel}</span>
                <span>Uploaded by {material.uploadedBy}</span>
                <span>• {material.uploadDate}</span>
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === material.id ? null : material.id)}
                  className="inline-flex items-center rounded-full border border-base bg-surface px-4 py-2 text-sm font-semibold text-navy transition hover:border-navy hover:text-navy"
                >
                  {openId === material.id ? "Hide preview" : "Preview resource"}
                </button>
                {openId === material.id && (
                  <p className="mt-3 rounded-2xl border border-base bg-[var(--surface-strong)] p-4 text-sm text-muted">
                    File preview isn&apos;t connected yet — this will open the actual {material.type.toLowerCase()} once uploads are wired up to storage.
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
