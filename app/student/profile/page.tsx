"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/StatBar";
import { StatRadarChart } from "@/components/profile/StatRadarChart";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Wardrobe } from "@/components/profile/Wardrobe";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useFriendsStore } from "@/lib/friendsStore";
import { useMyEnrollment } from "@/lib/useEnrollment";
import { useRankStore } from "@/lib/rankStore";
import { useShop } from "@/lib/shopStore";
import { createClient } from "@/lib/supabase/client";
import { EnrolledBadge } from "@/components/ui/EnrolledBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";

export default function StudentProfilePage() {
  const { profile, loading, updateProfile, uploadAvatar, removeAvatar } = useMyProfile();
  const { getEntriesByProfile, getStudentAverageByProfile, courses, programs, sections, students: enrollments } = useClassroomHierarchy();
  const { effective: enrollment, loading: enrollmentLoading } = useMyEnrollment();
  const { rankOf } = useRankStore();
  const { equippedProfileCard } = useShop();

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
  const myRank = profile ? rankOf(profile.id) : null;
  const overallRank = myRank?.current_rank ?? "D";
  const rankBar = myRank && myRank.current_rank !== "EX" ? myRank.current_bar : null;
  const rankExScore = myRank?.current_rank === "EX" ? myRank.ex_score : null;
  const hobbiesList = hobbies.split(",").map((h) => h.trim()).filter(Boolean);

  // Season history (Section 10) - peak rank per season, for the season card.
  const [seasonHistory, setSeasonHistory] = useState<any[] | null>(null);
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const supabase = createClient();
    (supabase as any)
      .rpc("get_season_history", { p_student_id: profile.id })
      .then(({ data, error: rpcError }: any) => {
        if (cancelled) return;
        if (!rpcError) setSeasonHistory((data ?? []) as any[]);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

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
      <CornerFrame className="relative space-y-6 overflow-hidden rounded-[10px] border border-base bg-surface p-5">
        {equippedProfileCard?.image_url && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${equippedProfileCard.image_url})` }}
            />
            <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface)_var(--art-tint),transparent)]" />
          </>
        )}
        <div className="relative space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="group relative">
            <UserAvatar
              name={profile.full_name}
              src={profile.avatar_url}
              size="2xl"
              className="border-2 border-surface"
              profileId={profile.id}
            />
            {/* Instagram-style pencil sits ON the avatar: opens the photo/name editor. */}
            <button
              type="button"
              onClick={() => { setEditOpen(true); setPhotoMessage(null); }}
              aria-label="Edit profile"
              title="Edit profile"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-base bg-surface text-muted shadow-sm transition hover:border-gold hover:text-navy"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h1 className="text-3xl font-bold text-navy">{profile.full_name}</h1>
              {!enrollmentLoading && <EnrolledBadge status={enrollment} size="sm" />}
            </div>
            <p className="mt-2 text-sm text-muted">
              {[profile.educational_level, profile.program ?? (academicInfo?.programs ?? []).map((p) => p.name).join(" · "), profile.level_label]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {/* Bio sits right under the course/year line, like a social profile. */}
            {bio.trim() && <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{bio}</p>}
            {hobbiesList.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {hobbiesList.map((h) => (
                  <span key={h} className="rounded-full border border-line bg-tile px-2.5 py-0.5 text-[11px] text-muted">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
              <span key={tag} className="rounded-full border border-base px-3 py-1 text-[11px] font-medium text-navy">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-5 text-center">
          {/* Rank is the hero; the bar/excellence value renders smaller underneath. */}
          <RankBadge rank={overallRank} size="lg" bar={rankBar} exScore={rankExScore} />
        </div>

        {/* Season history - the rank card a caller asked for: "Grade 12 ICT - First Semester 2026-2027: S++". */}
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Season history</h2>
          {seasonHistory === null ? (
            <p className="text-sm text-muted">Loading seasons...</p>
          ) : seasonHistory.length === 0 ? (
            <p className="text-sm text-muted">No seasons recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {seasonHistory.map((s: any) => (
                <div key={s.season_id} className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">
                        {[s.school_year, s.semester_label].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[s.grade_level, s.strand_or_track, s.section].filter(Boolean).join(" · ") || "-"}
                      </p>
                    </div>
                    <RankBadge rank={s.peak_rank} size="sm" />
                  </div>
                  <p className="mt-2 text-[11px] text-muted">
                    Reset to <span className="font-semibold text-navy">{s.reset_to_rank}</span> for the next season
                    {s.ex_achieved ? " · EX achieved" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CornerFrame>
        </div>
      </CornerFrame>

      <div className="space-y-6">
        <Wardrobe />

        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">Stat overview</h2>
          <StatRadarChart stats={{ academic: academicExcellence, physical: 0, charisma: 0 }} />
          <p className="mt-2 text-xs text-muted">
            Physical and Social stats aren&apos;t tracked yet - only Academic reflects real grade data right now.
          </p>
        </CornerFrame>

        {academicInfo && academicInfo.courses.length > 0 && (
          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-navy">My courses</h2>
            <div className="flex flex-wrap gap-2">
              {academicInfo.courses.map((c) => (
                <span key={c.id} className="rounded-full border border-base bg-[var(--surface-strong)] px-3 py-1 text-xs font-medium text-navy">
                  {c.name}
                </span>
              ))}
            </div>
          </CornerFrame>
        )}

        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
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

        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
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
              className="w-full rounded-[10px] border border-base bg-surface p-4 text-sm text-navy outline-none focus:border-gold"
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
                  className="mt-2 w-full rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
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
                  className="mt-2 w-full rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
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
                className="mt-2 w-full rounded-[10px] border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              />
            ) : (
              <p className="mt-2 text-sm text-navy">{tags || "Not set"}</p>
            )}
          </div>
        </CornerFrame>

        {/* Friends Section */}
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Friends</h2>
          {friendsLoading ? (
            <p className="mt-4 text-sm text-muted">Loading friends...</p>
          ) : friendsError ? (
            <p className="mt-4 text-sm text-red-500">{friendsError}</p>
          ) : friends.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No friends yet.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-4">
              {friends.map((friend) => (
                <Link
                  key={friend.id}
                  href={`/student/profile/${friend.id}`}
                  className="flex shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-tile p-[2px]">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-surface">
                      <UserAvatar name={friend.fullName} src={friend.avatarUrl} size="xl" profileId={friend.id} />
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
            className="w-full max-w-sm rounded-[10px] border border-base bg-surface p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Edit profile</p>
            <h2 className="mt-2 text-xl font-bold text-navy">Profile picture</h2>

            <div className="mt-5 flex flex-col items-center text-center">
              <UserAvatar
                name={profile.full_name}
                src={profile.avatar_url}
                size="2xl"
                className="border-2 border-surface"
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
                className="w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50"
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
