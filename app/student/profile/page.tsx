"use client";

import { useRef, useState } from "react";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/StatBar";
import { StatRadarChart } from "@/components/profile/StatRadarChart";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { CURRENT_STUDENT, CURRENT_QUARTER } from "@/data/mockStudents";

const SUBJECT_CHOICES = ["Mathematics", "English", "Science", "PE"];

export default function StudentProfilePage() {
  const student = CURRENT_STUDENT;
  const [bio, setBio] = useState(student.bio);
  const [isEditingBio, setIsEditingBio] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState("/avatars/default-avatar.webp");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [favoriteSubject, setFavoriteSubject] = useState(student.favoriteSubject);
  const [isEditingSubject, setIsEditingSubject] = useState(false);

  const [hobbies, setHobbies] = useState(student.hobbies.join(", "));
  const [isEditingHobbies, setIsEditingHobbies] = useState(false);

  const [tags, setTags] = useState(student.tags.join(", "));
  const [isEditingTags, setIsEditingTags] = useState(false);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.3fr]">
      <CornerFrame className="space-y-6 rounded-3xl border border-base bg-surface p-6 shadow-card">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="group relative">
            <img src={avatarUrl} alt={student.name} className="h-24 w-24 rounded-full border-2 border-gold object-cover" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Change profile picture"
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-gold text-navy shadow-card transition group-hover:scale-110"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-navy">{student.name}</h1>
            <p className="mt-2 text-sm text-muted">Grade {student.gradeLevel} · {student.section}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">{CURRENT_QUARTER}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
              <span key={tag} className="rounded-full border border-base px-3 py-1 text-[11px] font-medium text-navy">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gold bg-[var(--surface-strong)] p-5 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Academic Excellence</p>
          <p className="mt-3 text-4xl font-bold text-navy">{student.academicExcellence}</p>
          <RankBadge rank={student.overallRank} size="lg" className="mt-4" />
        </div>
      </CornerFrame>

      <div className="space-y-6">
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Stat overview</h2>
          <StatRadarChart stats={student.stats} />
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Subject stats</h2>
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
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">About</h2>
            <button
              type="button"
              onClick={() => setIsEditingBio((prev) => !prev)}
              className="rounded-full border border-base px-3 py-1 text-xs font-semibold text-navy transition hover:border-gold"
            >
              {isEditingBio ? "Done" : "Edit"}
            </button>
          </div>

          {isEditingBio ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-base bg-surface p-4 text-sm text-navy outline-none focus:border-gold"
            />
          ) : (
            <p className="text-sm leading-6 text-muted">{bio}</p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted">Favorite subject</p>
                <button
                  type="button"
                  onClick={() => setIsEditingSubject((prev) => !prev)}
                  className="text-[11px] font-semibold text-navy underline decoration-gold underline-offset-2"
                >
                  {isEditingSubject ? "Done" : "Edit"}
                </button>
              </div>
              {isEditingSubject ? (
                <select
                  value={favoriteSubject}
                  onChange={(e) => setFavoriteSubject(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                >
                  {SUBJECT_CHOICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-sm text-navy">{favoriteSubject}</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted">Hobbies</p>
                <button
                  type="button"
                  onClick={() => setIsEditingHobbies((prev) => !prev)}
                  className="text-[11px] font-semibold text-navy underline decoration-gold underline-offset-2"
                >
                  {isEditingHobbies ? "Done" : "Edit"}
                </button>
              </div>
              {isEditingHobbies ? (
                <input
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="Separate with commas"
                  className="mt-2 w-full rounded-xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                />
              ) : (
                <p className="mt-2 text-sm text-navy">{hobbies}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-muted">Tags</p>
              <button
                type="button"
                onClick={() => setIsEditingTags((prev) => !prev)}
                className="text-[11px] font-semibold text-navy underline decoration-gold underline-offset-2"
              >
                {isEditingTags ? "Done" : "Edit"}
              </button>
            </div>
            {isEditingTags ? (
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Separate with commas"
                className="mt-2 w-full rounded-xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
            ) : (
              <p className="mt-2 text-sm text-navy">{tags}</p>
            )}
          </div>
        </CornerFrame>
      </div>
    </div>
  );
}
