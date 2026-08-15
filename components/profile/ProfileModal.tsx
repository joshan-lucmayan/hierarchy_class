"use client";

import { useRouter } from "next/navigation";
import { useMyProfile } from "@/lib/useMyProfile";
import { useFriendsStore } from "@/lib/friendsStore";
import { useAcademicIdentity } from "@/lib/useAcademicIdentity";
import { useRankStore } from "@/lib/rankStore";
import { useSchoolEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { EnrolledBadge } from "@/components/ui/EnrolledBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RankBadge } from "@/components/ui/RankBadge";
import type { ProfileRow } from "@/types/supabase";

/**
 * Profile preview that opens in place (over the current page) when a person is
 * picked from a search result - the menu never changes. Full profile still
 * lives at /student/profile/[id] for deep links.
 */
export function ProfileModal({ person, onClose }: { person: ProfileRow; onClose: () => void }) {
  const router = useRouter();
  const { profile: me } = useMyProfile();
  const { rankOf } = useRankStore();
  const { getCoursesByTeacher } = useClassroomHierarchy();
  const identity = useAcademicIdentity(person.id);
  const { statuses } = useSchoolEnrollments();
  const { friendIds, addFriend, removeFriend } = useFriendsStore();

  const isStudent = person.role === "student";
  const isFriend = friendIds.includes(person.id);
  const isSelf = me?.id === person.id;
  const coursesTaught = isStudent ? [] : getCoursesByTeacher(person.id);
  const viewedRank = isStudent ? rankOf(person.id) : null;
  const rank = viewedRank?.current_rank ?? "D";
  const rankBar = viewedRank && viewedRank.current_rank !== "EX" ? viewedRank.current_bar : null;
  const rankExScore = viewedRank?.current_rank === "EX" ? viewedRank.ex_score : null;
  const identityLine = [person.educational_level, person.program ?? identity.programNames.join(" · "), person.level_label]
    .filter(Boolean)
    .join(" · ");
  const enrollment = statuses[person.id]
    ? effectiveFrom({
        status: statuses[person.id].status,
        expires_at: statuses[person.id].expiresAt,
      } as any)
    : "unknown";

  const hobbies = Array.isArray(person.hobbies) && person.hobbies.length > 0 ? person.hobbies : [];

  function toggleFriend() {
    if (isFriend) removeFriend(person.id);
    else addFriend(person.id);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[10px] border border-base bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Flat social cover strip - decorative only, token-based. */}
        <div className="relative h-20 bg-asphalt/50">
          <div className="absolute right-5 top-4 h-7 w-7 rounded-lg border border-line bg-tile/40" />
          <div className="absolute bottom-3 left-8 h-3 w-14 rounded-full border border-line bg-tile/30" />
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-col items-center text-center">
            <UserAvatar
              name={person.full_name}
              src={person.avatar_url}
              size="2xl"
              className="border-2 border-surface"
            />
            {/* Name + Message button on the SAME line - the action aligns with the name. */}
            <div className="mt-3 flex w-full items-center justify-center gap-3">
              <div className="min-w-0 text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <h2 className="truncate text-xl font-bold text-navy">{person.full_name}</h2>
                  {isStudent && !isSelf && <EnrolledBadge status={enrollment} size="sm" />}
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
                  {isStudent ? "Student" : "Faculty"}
                </p>
                {isStudent && identityLine && <p className="mt-1 text-sm text-muted">{identityLine}</p>}
              </div>
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => router.push(`/student/messages?with=${person.id}`)}
                  className="shrink-0 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
                >
                  Message
                </button>
              )}
            </div>

            {isStudent && !isSelf && (
              <div className="mt-3">
                <RankBadge rank={rank} size="sm" bar={rankBar} exScore={rankExScore} />
              </div>
            )}

            {person.bio && <p className="mt-4 w-full text-left text-sm leading-6 text-muted">{person.bio}</p>}
            {hobbies.length > 0 && (
              <div className="mt-3 flex w-full flex-wrap justify-center gap-2">
                {hobbies.map((h) => (
                  <span
                    key={h}
                    className="rounded-full border border-line bg-tile px-2.5 py-0.5 text-[11px] text-muted"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>

          {!isStudent && coursesTaught.length > 0 && (
            <div className="mt-4 border-t border-base pt-4 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">Teaching</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {coursesTaught.map((course) => (
                  <span
                    key={course.id}
                    className="rounded-full border border-line bg-tile px-2.5 py-0.5 text-[11px] text-navy"
                  >
                    {course.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-2">
            {isStudent && !isSelf && (
              <button
                type="button"
                onClick={toggleFriend}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  isFriend
                    ? "border border-base bg-surface text-muted hover:border-red-400 hover:text-red-600"
                    : "bg-gold text-on-accent hover:opacity-90"
                }`}
              >
                {isFriend ? "Remove Friend" : "Add Friend"}
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/student/profile/${person.id}`)}
              className="rounded-full border border-base px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
            >
              View full profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
