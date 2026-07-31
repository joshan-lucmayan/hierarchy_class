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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-6">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="border-b border-base bg-transparent px-1 py-2 text-sm font-semibold text-navy outline-none focus:border-gold"
          >
            {SUBJECT_OPTIONS.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="border-b border-base bg-transparent px-1 py-2 text-sm font-semibold text-navy outline-none focus:border-gold"
          >
            {GRADE_OPTIONS.map((grade) => (
              <option key={grade} value={grade}>{grade === "All" ? "All grades" : `Grade ${grade}`}</option>
            ))}
          </select>
        </div>
        <span className="text-xs font-semibold text-muted">
          {materials.length} resource{materials.length === 1 ? "" : "s"}
        </span>
      </div>

      {materials.length === 0 ? (
        <p className="text-sm text-muted">No matching learning materials found. Try a different grade or subject filter.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {materials.map((material: LearningMaterial) => (
            <div key={material.id} className="py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted">{material.subject}</p>
                  <h2 className="mt-2 text-lg font-semibold text-navy">{material.title}</h2>
                </div>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gold">
                  {material.type}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{material.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>Grade {material.gradeLevel}</span>
                <span>Uploaded by {material.uploadedBy}</span>
                <span>{material.uploadDate}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(openId === material.id ? null : material.id)}
                className="mt-4 text-xs font-semibold text-muted transition hover:text-gold"
              >
                {openId === material.id ? "Close resource ↑" : "Open resource →"}
              </button>
              {openId === material.id && (
                <p className="mt-3 text-xs text-muted">
                  File isn&apos;t connected yet - this will open the actual {material.type.toLowerCase()} once uploads are wired up to storage.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
