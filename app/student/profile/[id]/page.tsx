"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMyProfile } from "@/lib/useMyProfile";
import { useFriendsStore } from "@/lib/friendsStore";
import { useLeaderboard, rankFromAverage } from "@/lib/useLeaderboard";
import { useAcademicIdentity } from "@/lib/useAcademicIdentity";
import { useSchoolEnrollments, effectiveFrom } from "@/lib/useEnrollment";
import { EnrolledBadge } from "@/components/ui/EnrolledBadge";
import { createClient } from "@/lib/supabase/client";
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
  const { friendIds, addFriend, removeFriend } = useFriendsStore();
  const identity = useAcademicIdentity(profileId);
  const { statuses } = useSchoolEnrollments();

  const [person, setPerson] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [charismaOpen, setCharismaOpen] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, [profileId, me, meLoading, router]);

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
  const avg = averageOf(person.id) ?? 0;
  const rank = rankFromAverage(avg > 0 ? avg : null);
  const identityLine = [person.educational_level, person.level_label, identity.programNames.join(" · ")]
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
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-8 shadow-card">
        <div className="flex flex-col items-center gap-5 text-center">
          <img
            src={person.avatar_url || "/avatars/default-avatar.webp"}
            alt={person.full_name}
            className="h-24 w-24 rounded-full border-2 border-gold object-cover"
          />
          <div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h1 className="text-3xl font-bold text-navy">{person.full_name}</h1>
              {isStudent && <EnrolledBadge status={enrollment} size="sm" />}
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold">
              {isStudent ? "Student" : "Faculty"}
            </p>
            {isStudent && identityLine && <p className="mt-2 text-sm text-muted">{identityLine}</p>}
          </div>

          {isStudent && (
            <div className="flex flex-col items-center gap-2">
              <RankBadge rank={rank} size="lg" />
              <p className="text-xs text-muted">
                Academic excellence: <span className="font-semibold text-navy">{avg > 0 ? avg : "--"}</span>/100
              </p>
            </div>
          )}
        </div>

        {person.bio && <p className="mt-6 text-center text-sm leading-6 text-muted">{person.bio}</p>}
        {person.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
            {person.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}

        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push(`/student/messages?with=${person.id}`)}
            className="rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
          >
            Message
          </button>
          {isStudent && (
            <button
              type="button"
              onClick={toggleFriend}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                isFriend
                  ? "border border-base bg-surface text-muted hover:border-red-400 hover:text-red-600"
                  : "bg-gold text-navy hover:opacity-90"
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
      </CornerFrame>

      {isStudent && (
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
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
      <div className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
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
                  className={`rounded-2xl border px-2 py-3 text-center transition ${
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
              className="mt-5 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-navy transition hover:opacity-90"
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
