"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useFriendsStore } from "@/lib/friendsStore";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Modal } from "@/components/ui/Modal";

/**
 * "See All" friends view for the student profile.
 *
 * The profile preview shows the first few friends; this modal renders the
 * complete friend list (the friends store already loads the full list once,
 * so no extra network cost on open) with profile navigation, loading, empty,
 * and error states. Paginated in view so the DOM never renders an endlessly
 * growing list even for a large friend set.
 */

const PAGE = 20;

export function FriendsModal({ onClose }: { onClose: () => void }) {
  const { friends, loading, error } = useFriendsStore();
  const [visible, setVisible] = useState(PAGE);

  // Reset pagination when the list length changes (a friend was added/removed).
  useEffect(() => {
    setVisible(PAGE);
  }, [friends.length]);

  const visibleFriends = friends.slice(0, visible);

  return (
    <Modal eyebrow="Friends" description="Everyone you're connected with" onClose={onClose} ariaLabel="Friends">
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading friends...</p>
      ) : error ? (
        <p className="mt-4 text-sm text-warn">{error}</p>
      ) : friends.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No friends yet.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-1">
            {visibleFriends.map((friend) => (
              <Link
                key={friend.id}
                href={`/student/profile/${friend.id}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-[10px] border border-base bg-surface px-3 py-2.5 transition hover:border-gold"
              >
                <UserAvatar name={friend.fullName} src={friend.avatarUrl} size="md" profileId={friend.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{friend.fullName}</p>
                  {friend.levelLabel && <p className="truncate text-xs text-muted">{friend.levelLabel}</p>}
                </div>
                <span className="text-faint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
          {friends.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((c) => c + PAGE)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-base bg-surface py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-navy transition hover:border-gold-soft"
            >
              Load More ({visible} of {friends.length})
            </button>
          )}
        </>
      )}
    </Modal>
  );
}
