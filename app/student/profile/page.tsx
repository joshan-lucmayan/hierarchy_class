"use client";

import { useMemo, useRef, useState } from "react";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/StatBar";
import { StatRadarChart } from "@/components/profile/StatRadarChart";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

export default function StudentProfilePage() {
  const { profile, loading, updateProfile, uploadAvatar } = useMyProfile();
  const { getEntriesByProfile, getStudentAverageByProfile, getStudentRankByProfile, courses } = useClassroomHierarchy();

  const [bio, setBio] = useState("");
  const [isEditingBio, setIsEditingBio] = useState(false);

  const [favoriteSubject, setFavoriteSubject] = useState("");
  const [isEditingSubject, setIsEditingSubject] = useState(false);

  const [hobbies, setHobbies] = useState("");
  const [isEditingHobbies, setIsEditingHobbies] = useState(false);

  const [tags, setTags] = useState("");
  const [isEditingTags, setIsEditingTags] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed local edit-buffers once the real profile arrives
  const [hydrated, setHydrated] = useState(false);
  if (profile && !hydrated) {
    setBio(profile.bio ?? "");
    setFavoriteSubject(profile.favorite_subject ?? "");
    setHobbies((Array.isArray(profile.hobbies) ? profile.hobbies : []).join(", "));
    setTags((Array.isArray(profile.tags) ? profile.tags : []).join(", "));
    setHydrated(true);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadAvatar(file);
    setUploading(false);
  }

  async function saveBio() {
    await updateProfile({ bio });
    setIsEditingBio(false);
  }
  async function saveFavoriteSubject() {
    await updateProfile({ favorite_subject: favoriteSubject });
    setIsEditingSubject(false);
  }
  async function saveHobbies() {
    await updateProfile({ hobbies: hobbies.split(",").map((h) => h.trim()).filter(Boolean) });
    setIsEditingHobbies(false);
  }
  async function saveTags() {
    await updateProfile({ tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
    setIsEditingTags(false);
  }

  const academicExcellence = profile ? getStudentAverageByProfile(profile.id) ?? 0 : 0;
  const overallRank = profile ? getStudentRankByProfile(profile.id) ?? "D" : "D";

  const courseBreakdown = useMemo(() => {
    if (!profile) return [];
    const entries = getEntriesByProfile(profile.id);
    const byCourse = new Map<string, number[]>();
    entries.forEach((e) => {
      if (!byCourse.has(e.courseId)) byCourse.set(e.courseId, []);
      byCourse.get(e.courseId)!.push(e.score);
    });
    return Array.from(byCourse.entries()).map(([courseId, scores]) => {
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      const course = courses.find((c) => c.id === courseId);
      return { courseId, courseName: course?.name ?? "Unknown course", avg };
    });
  }, [profile, getEntriesByProfile, courses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted">Loading your profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted">Couldn&apos;t load your profile. Please sign in again.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.3fr]">
      <CornerFrame className="space-y-6 rounded-3xl border border-base bg-surface p-6 shadow-card">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="group relative">
            <img
              src={profile.avatar_url || "/avatars/default-avatar.webp"}
              alt={profile.full_name}
              className="h-24 w-24 rounded-full border-2 border-gold object-cover"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Change profile picture"
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-gold text-navy shadow-card transition group-hover:scale-110 disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-navy">{profile.full_name}</h1>
            <p className="mt-2 text-sm text-muted">
              {profile.level_label ?? ""}{profile.section ? ` · ${profile.section}` : ""}
            </p>
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
          <p className="mt-3 text-4xl font-bold text-navy">{academicExcellence > 0 ? academicExcellence : "--"}</p>
          <RankBadge rank={overallRank} size="lg" className="mt-4" />
        </div>
      </CornerFrame>

      <div className="space-y-6">
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Stat overview</h2>
          <StatRadarChart stats={{ academic: academicExcellence, physical: 0, charisma: 0 }} />
          <p className="mt-2 text-xs text-muted">
            Physical and Social stats aren&apos;t tracked yet - only Academic reflects real grade data right now.
          </p>
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Course stats</h2>
          {courseBreakdown.length === 0 ? (
            <p className="text-sm text-muted">No grades recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {courseBreakdown.map((c) => (
                <div key={c.courseId} className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="flex-1">
                    <StatBar label={c.courseName} value={c.avg} category="academic" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-muted">Grades and ranks are set by your teachers and can&apos;t be edited here.</p>
        </CornerFrame>

        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">About</h2>
            <button
              type="button"
              onClick={() => (isEditingBio ? saveBio() : setIsEditingBio(true))}
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
            <p className="text-sm leading-6 text-muted">{bio || "No bio yet."}</p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted">Favorite subject</p>
                <button
                  type="button"
                  onClick={() => (isEditingSubject ? saveFavoriteSubject() : setIsEditingSubject(true))}
                  className="text-[11px] font-semibold text-navy underline decoration-gold underline-offset-2"
                >
                  {isEditingSubject ? "Done" : "Edit"}
                </button>
              </div>
              {isEditingSubject ? (
                <input
                  value={favoriteSubject}
                  onChange={(e) => setFavoriteSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  className="mt-2 w-full rounded-xl border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                />
              ) : (
                <p className="mt-2 text-sm text-navy">{favoriteSubject || "Not set"}</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-muted">Hobbies</p>
                <button
                  type="button"
                  onClick={() => (isEditingHobbies ? saveHobbies() : setIsEditingHobbies(true))}
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
                <p className="mt-2 text-sm text-navy">{hobbies || "Not set"}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-muted">Tags</p>
              <button
                type="button"
                onClick={() => (isEditingTags ? saveTags() : setIsEditingTags(true))}
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
              <p className="mt-2 text-sm text-navy">{tags || "Not set"}</p>
            )}
          </div>
        </CornerFrame>
      </div>
    </div>
  );
}
