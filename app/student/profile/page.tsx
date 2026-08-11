"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/StatBar";
import { StatRadarChart } from "@/components/profile/StatRadarChart";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useFriendsStore } from "@/lib/friendsStore";
import { useMyEnrollment } from "@/lib/useEnrollment";
import { EnrolledBadge } from "@/components/ui/EnrolledBadge";

export default function StudentProfilePage() {
  const { profile, loading, updateProfile, uploadAvatar, removeAvatar } = useMyProfile();
  const { getEntriesByProfile, getStudentAverageByProfile, getStudentRankByProfile, courses, programs, sections, students: enrollments } = useClassroomHierarchy();
  const { effective: enrollment, loading: enrollmentLoading } = useMyEnrollment();

  const [bio, setBio] = useState("");
  const [isEditingBio, setIsEditingBio] = useState(false);

  const [favoriteSubject, setFavoriteSubject] = useState("");
  const [isEditingSubject, setIsEditingSubject] = useState(false);

  const [hobbies, setHobbies] = useState("");
  const [isEditingHobbies, setIsEditingHobbies] = useState(false);

  const [tags, setTags] = useState("");
  const [isEditingTags, setIsEditingTags] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
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
    setPhotoMessage(null);
    await uploadAvatar(file);
    setUploading(false);
    setPhotoMessage("Profile picture updated.");
  }

  async function handleRemoveAvatar() {
    if (!window.confirm("Remove your profile picture? Your default avatar will be shown instead.")) return;
    setUploading(true);
    setPhotoMessage(null);
    await removeAvatar();
    setUploading(false);
    setPhotoMessage("Profile picture removed.");
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

  const { friends, loading: friendsLoading, error: friendsError } = useFriendsStore();

  const academicExcellence = profile ? getStudentAverageByProfile(profile.id) ?? 0 : 0;
  const overallRank = profile ? getStudentRankByProfile(profile.id) ?? "D" : "D";

  const academicInfo = useMemo(() => {
    if (!profile) return null;
    const enrolledCourseIds = enrollments.filter((e) => e.profileId === profile.id).map((e) => e.courseId);
    const myCourses = courses.filter((c) => enrolledCourseIds.includes(c.id));
    const mySectionIds = Array.from(new Set(myCourses.map((c) => c.sectionId)));
    const mySections = sections.filter((s) => mySectionIds.includes(s.id));
    const myProgramIds = Array.from(new Set(mySections.map((s) => s.programId)));
    const myPrograms = programs.filter((p) => myProgramIds.includes(p.id));
    return { programs: myPrograms, sections: mySections, courses: myCourses };
  }, [profile, enrollments, courses, sections, programs]);

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
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h1 className="text-3xl font-bold text-navy">{profile.full_name}</h1>
              {!enrollmentLoading && <EnrolledBadge status={enrollment} size="sm" />}
            </div>
            <p className="mt-2 text-sm text-muted">
              {profile.level_label ?? ""}{profile.section ? ` · ${profile.section}` : ""}
            </p>
            <button
              type="button"
              onClick={() => { setEditOpen(true); setPhotoMessage(null); }}
              className="mt-3 rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
            >
              Edit Profile
            </button>
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

        {academicInfo && (academicInfo.programs.length > 0 || academicInfo.courses.length > 0) && (
          <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Academic information</h2>
            <div className="space-y-4">
              {academicInfo.programs.map((p) => (
                <div key={p.id}>
                  <p className="text-sm font-semibold text-navy">Program / Grade Level: {p.name}</p>
                  {academicInfo.sections
                    .filter((s) => s.programId === p.id)
                    .map((s) => (
                      <div key={s.id} className="mt-2">
                        <p className="text-xs text-muted">Section / Year: {s.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {academicInfo.courses
                            .filter((c) => c.sectionId === s.id)
                            .map((c) => (
                              <span key={c.id} className="rounded-full border border-base bg-[var(--surface-strong)] px-3 py-1 text-xs font-medium text-navy">
                                {c.name}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </CornerFrame>
        )}

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

        {/* Friends Section */}
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Friends</h2>
          {friendsLoading ? (
            <p className="mt-4 text-sm text-muted">Loading friends...</p>
          ) : friendsError ? (
            <p className="mt-4 text-sm text-red-500">{friendsError}</p>
          ) : friends.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No friends yet. <Link href="/student/search" className="text-navy underline decoration-gold underline-offset-2">Find classmates</Link> to add.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-4">
              {friends.map((friend) => (
                <Link
                  key={friend.id}
                  href={`/student/search?profile=${friend.id}`}
                  className="flex shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-strong)] p-[2px]">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-navy">
                      <img
                        src={friend.avatarUrl || "/avatars/default-avatar.webp"}
                        alt={friend.fullName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <span className="max-w-[64px] truncate text-[11px] font-medium text-muted">
                    {friend.fullName.split(" ")[0]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CornerFrame>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Edit profile</p>
            <h2 className="mt-2 text-xl font-bold text-navy">Profile picture</h2>

            <div className="mt-5 flex flex-col items-center text-center">
              <img
                src={profile.avatar_url || "/avatars/default-avatar.webp"}
                alt={profile.full_name}
                className="h-24 w-24 rounded-full border-2 border-gold object-cover"
              />
              {photoMessage && <p className="mt-3 text-xs font-semibold text-emerald-600">{photoMessage}</p>}
              <p className="mt-2 text-xs text-muted">
                {profile.avatar_url ? "Your current picture" : "You're using the default avatar"}
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-navy transition hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : profile.avatar_url ? "Change photo" : "Upload photo"}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleRemoveAvatar}
                  className="w-full rounded-full border border-red-300 bg-surface py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="w-full rounded-full border border-base py-2.5 text-sm font-semibold text-muted transition hover:border-gold"
              >
                Close
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
}
