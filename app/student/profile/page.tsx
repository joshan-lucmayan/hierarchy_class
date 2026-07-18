"use client";

import { useState } from "react";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/StatBar";
import { StatRadarChart } from "@/components/profile/StatRadarChart";
import { CURRENT_STUDENT } from "@/data/mockStudents";

export default function StudentProfilePage() {
  const student = CURRENT_STUDENT;
  const [bio, setBio] = useState(student.bio);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.3fr]">
      <section className="space-y-6 rounded-3xl border border-base bg-surface p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-navy text-2xl font-bold text-gold">
            {student.initials}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-navy">{student.name}</h1>
            <p className="mt-2 text-sm text-muted">Grade {student.gradeLevel} · {student.section}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {student.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-base px-3 py-1 text-[11px] font-medium text-navy">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-base bg-[var(--surface-strong)] p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted">Academic Excellence</p>
          <p className="mt-3 text-4xl font-bold text-navy">{student.academicExcellence}</p>
          <RankBadge rank={student.overallRank} size="lg" className="mt-4" />
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-3xl border border-base bg-surface p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-navy">Stat overview</h2>
          <StatRadarChart stats={student.stats} />
        </section>

        <section className="rounded-3xl border border-base bg-surface p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-navy">Subject stats</h2>
          <div className="space-y-4">
            {student.subjectStats.map((s) => (
              <div key={s.subject} className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex-1">
                  <StatBar label={`${s.subject} · ${s.statLabel}`} value={s.value} category={s.category} />
                </div>
                <RankBadge rank={s.rank} size="sm" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Grades and ranks are set by your teachers and can&apos;t be edited here.</p>
        </section>

        <section className="rounded-3xl border border-base bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-navy">About</h2>
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="text-xs font-semibold text-navy"
            >
              {isEditing ? "Done" : "Edit"}
            </button>
          </div>

          {isEditing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-base bg-surface p-4 text-sm outline-none focus:border-navy"
            />
          ) : (
            <p className="text-sm leading-6 text-muted">{bio}</p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Favorite subject</p>
              <p className="mt-2 text-sm text-navy">{student.favoriteSubject}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Hobbies</p>
              <p className="mt-2 text-sm text-navy">{student.hobbies.join(", ")}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
