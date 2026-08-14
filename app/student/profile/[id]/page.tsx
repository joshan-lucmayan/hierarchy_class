"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMyProfile } from "@/lib/useMyProfile";
import { useFriendsStore } from "@/lib/friendsStore";
import { useLeaderboard, rankFromAverage } from "@/lib/useLeaderboard";
import { useAcademicIdentity } from "@/lib/useAcademicIdentity";
import { useSchoolEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { useSchools } from "@/lib/useSchools";
import { EnrolledBadge } from "@/components/ui/EnrolledBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { randomId } from "@/lib/randomId";
import { RankBadge } from "@/components/ui/RankBadge";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { StatRadarChart } from "@/components/profile/StatRadarChart";
import type { ProfileRow } from "@/types/supabase";

const COIN_PACKAGES = [
  { coins: 10, price: 49 },
  { coins: 50, price: 199 },
  { coins: 100, price: 349 },
];

export default function ViewProfilePage({ params }: { params: { id: string } }) {
  const profileId = params.id;
  const router = useRouter();
  const { profile: me, loading: meLoading } = useMyProfile();
  const { averageOf } = useLeaderboard();
  const { getCoursesByTeacher } = useClassroomHierarchy();
  const { schools } = useSchools();
  const { friendIds, addFriend, removeFriend } = useFriendsStore();
  const identity = useAcademicIdentity(profileId);
  const { statuses } = useSchoolEnrollments();

  const [person, setPerson] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [charismaOpen, setCharismaOpen] = useState(false);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    if (meLoading) return;
    if (me && me.id === profileId) {
      router.replace("/student/profile");
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError || !data) {
          setError("Couldn't find that person.");
        } else {
          setPerson(data as ProfileRow);
        }
        setLoading(false);
      });
    // Live profile: an admin editing this student's academic info (or the
    // student changing their avatar/bio) updates the open profile instantly.
    const channel = supabase
      .channel(`view-profile-${randomId()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          if (!cancelled) setRefetchTick((t) => t + 1);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profileId, me, meLoading, router, refetchTick]);

  if (loading || meLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted">Loading profile...</p>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-red-500">{error ?? "Profile not found."}</p>
      </div>
    );
  }

  const isStudent = person.role === "student";
  const isFriend = friendIds.includes(person.id);
  const coursesTaught = isStudent ? [] : getCoursesByTeacher(person.id);
  const avg = averageOf(person.id) ?? 0;
  const rank = rankFromAverage(avg > 0 ? avg : null);
  const identityLine = [person.educational_level, person.program ?? identity.programNames.join(" · "), person.level_label]
    .filter(Boolean)
    .join(" · ");
  const enrollment = statuses[person.id]
    ? effectiveFrom({
        status: statuses[person.id].status,
        expires_at: statuses[person.id].expiresAt,
      } as any)
    : "unknown";
  const personId = person.id;

  async function toggleFriend() {
    if (isFriend) removeFriend(personId);
    else addFriend(personId);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-2xl space-y-6">
      <CornerFrame className="overflow-hidden rounded-[10px] border border-base bg-surface">
        {/* Flat social cover strip - decorative only, token-based. */}
        <div className="relative h-24 bg-asphalt/50">
          <div className="absolute right-6 top-5 h-8 w-8 rounded-lg border border-line bg-tile/40" />
          <div className="absolute bottom-4 left-10 h-4 w-16 rounded-full border border-line bg-tile/30" />
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col items-center text-center">
            <UserAvatar
              name={person.full_name}
              src={person.avatar_url}
              size="2xl"
              className="border-2 border-surface"
            />
            <div className="mt-3 flex w-full items-center justify-center gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <h1 className="text-2xl font-bold text-navy">{person.full_name}</h1>
                  {isStudent && <EnrolledBadge status={enrollment} size="sm" />}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
                  {isStudent ? "Student" : "Faculty"}
                </p>
                {isStudent && identityLine && <p className="mt-1.5 text-sm text-muted">{identityLine}</p>}
              </div>
              <button
                type="button"
                onClick={() => router.push(`/student/messages?with=${person.id}`)}
                className="shrink-0 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-on-accent"
              >
                Message
              </button>
            </div>

            {isStudent && (
              <div className="mt-4">
                <RankBadge rank={rank} size="lg" score={avg > 0 ? avg : null} />
              </div>
            )}

            {person.bio && <p className="mt-4 max-w-xl text-sm leading-6 text-muted">{person.bio}</p>}
            {Array.isArray(person.hobbies) && person.hobbies.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {person.hobbies.map((h) => (
                  <span key={h} className="rounded-full border border-line bg-tile px-2.5 py-0.5 text-[11px] text-muted">
                    {h}
                  </span>
                ))}
              </div>
            )}
            {person.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {person.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-line bg-tile px-2.5 py-0.5 text-[11px] text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {isStudent && (
            <button
              type="button"
              onClick={toggleFriend}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                isFriend
                  ? "border border-base bg-surface text-muted hover:border-red-400 hover:text-red-600"
                  : "bg-gold text-on-accent hover:opacity-90"
              }`}
            >
              {isFriend ? "Remove Friend" : "Add Friend"}
            </button>
          )}
          {isStudent && (
            <button
              type="button"
              onClick={() => setCharismaOpen(true)}
              className="rounded-full border border-base px-4 py-2.5 text-sm font-semibold text-navy transition hover:border-gold sm:col-span-2"
            >
              Send Charisma
            </button>
          )}
          </div>

          {!isStudent && (
            <div className="mt-6 border-t border-base pt-5 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">About</p>
              <div className="mt-3 space-y-2.5 text-sm">
                {person.favorite_subject && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">Favorite subject</span>
                    <span className="font-medium text-navy">{person.favorite_subject}</span>
                  </div>
                )}
                {schools[0]?.name && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">School</span>
                    <span className="font-medium text-navy">{schools[0].name}</span>
                  </div>
                )}
                {coursesTaught.length > 0 && (
                  <div className="pt-1">
                    <p className="mb-2 text-muted">Teaching</p>
                    <div className="flex flex-wrap gap-2">
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
              </div>
            </div>
          )}
        </div>
      </CornerFrame>

      {isStudent && (
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Stat overview</h2>
          <div className="mt-4">
            <StatRadarChart stats={{ academic: avg, physical: 0, charisma: 0 }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Only Academic reflects real grade data right now; physical and social stats aren&apos;t tracked yet.
          </p>
        </CornerFrame>
      )}

      {charismaOpen && <SendCharismaModal person={person} onClose={() => setCharismaOpen(false)} />}
      </div>
    </div>
  );
}

function SendCharismaModal({ person, onClose }: { person: ProfileRow; onClose: () => void }) {
  const [selected, setSelected] = useState(COIN_PACKAGES[1].coins);
  const [sent, setSent] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[10px] border border-base bg-surface p-7" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <p className="mt-3 text-lg font-bold text-navy">Sent!</p>
            <p className="mt-2 text-sm text-muted">
              This is a UI preview only - Coin Charisma purchases aren&apos;t connected to real payments yet.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-on-accent"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 h-1 w-10 rounded-full bg-gold" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Coin Charisma</p>
            <h2 className="mt-2 text-xl font-bold text-navy">Send charisma to {person.full_name.split(" ")[0]}</h2>
            <p className="mt-2 text-sm text-muted">Choose a coin package to boost their charisma stat.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {COIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.coins}
                  type="button"
                  onClick={() => setSelected(pkg.coins)}
                  className={`rounded-[10px] border px-2 py-3 text-center transition ${
                    selected === pkg.coins ? "border-gold bg-[var(--surface-strong)]" : "border-base bg-surface hover:border-gold"
                  }`}
                >
                  <p className="text-lg font-bold text-navy">{pkg.coins}</p>
                  <p className="text-[11px] text-muted">coins</p>
                  <p className="mt-1 text-xs font-semibold text-gold">₱{pkg.price}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSent(true)}
              className="mt-5 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90"
            >
              Send {selected} coins
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-full border border-base py-2.5 text-sm font-semibold text-navy transition hover:border-gold"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
