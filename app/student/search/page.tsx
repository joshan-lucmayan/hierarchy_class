"use client";

import { useMemo, useState } from "react";
import { STUDENT_DIRECTORY } from "@/data/mockStudents";
import { StudentDirectoryEntry } from "@/types/student";
import { CornerFrame } from "@/components/ui/CornerFrame";

function ProfileCard({
  student,
  isFriend,
  onToggleFriend,
}: {
  student: StudentDirectoryEntry;
  isFriend: boolean;
  onToggleFriend: (id: string) => void;
}) {
  return (
    <CornerFrame className="rounded-3xl border border-base bg-surface p-4 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/avatars/default-avatar.webp" alt={student.name} className="h-12 w-12 rounded-full border-2 border-gold object-cover" />
          <div>
            <p className="text-sm font-semibold text-navy">{student.name}</p>
            <p className="text-xs text-muted">Grade {student.gradeLevel} · {student.section}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleFriend(student.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            isFriend
              ? "border border-base bg-surface text-muted hover:border-red-400 hover:text-red-600"
              : "bg-gold text-navy hover:opacity-90"
          }`}
        >
          {isFriend ? "Friends" : "Add Friend"}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-muted">{student.overallRank}</span>
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-semibold text-muted">{student.favoriteSubject}</span>
      </div>
      <div className="mt-4 text-sm text-muted">
        <p className="font-semibold text-muted">Tags</p>
        <p>{student.tags.join(", ")}</p>
      </div>
    </CornerFrame>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [friendIds, setFriendIds] = useState<string[]>(["s-010", "s-014", "s-022", "s-042"]);

  function toggleFriend(id: string) {
    setFriendIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

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
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Search</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Find classmates</h1>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, section, or subject"
            className="w-full max-w-md rounded-3xl border border-gold bg-[var(--surface-strong)] px-4 py-3 text-sm text-navy placeholder:text-muted outline-none"
          />
        </div>
      </CornerFrame>

      <section className="grid gap-4 xl:grid-cols-2">
        {results.length === 0 ? (
          <div className="rounded-3xl border border-base bg-surface p-6 text-muted shadow-card">
            No matching student profiles found.
          </div>
        ) : (
          results.map((student) => (
            <ProfileCard
              key={student.id}
              student={student}
              isFriend={friendIds.includes(student.id)}
              onToggleFriend={toggleFriend}
            />
          ))
        )}
      </section>
    </div>
  );
}
