"use client";

import { useMemo, useState } from "react";
import { STUDENT_DIRECTORY } from "@/data/mockStudents";
import { StudentDirectoryEntry } from "@/types/student";

function ProfileCard({ student }: { student: StudentDirectoryEntry }) {
  return (
    <div className="rounded-3xl border border-base bg-surface p-4 shadow-sm shadow-transparent">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
          {student.initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-navy">{student.name}</p>
          <p className="text-xs text-muted">Grade {student.gradeLevel} · {student.section}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-muted">{student.overallRank}</span>
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-muted">{student.favoriteSubject}</span>
      </div>
      <div className="mt-4 text-sm text-muted">
        <p className="font-semibold text-muted">Tags</p>
        <p>{student.tags.join(", ")}</p>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.toLowerCase();
    return STUDENT_DIRECTORY.filter((student) =>
      student.name.toLowerCase().includes(normalized) ||
      student.section.toLowerCase().includes(normalized) ||
      student.favoriteSubject.toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-base bg-surface p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Search</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Find classmates</h1>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, section, or subject"
            className="w-full max-w-md rounded-3xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-navy"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {results.length === 0 ? (
          <div className="rounded-3xl border border-base bg-surface p-6 text-muted">
            No matching student profiles found.
          </div>
        ) : (
          results.map((student) => <ProfileCard key={student.id} student={student} />)
        )}
      </section>
    </div>
  );
}
