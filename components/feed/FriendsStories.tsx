"use client";

import Link from "next/link";
import { useFriendsStore } from "@/lib/friendsStore";

export function FriendsStories() {
  const { friends, loading } = useFriendsStore();

  if (loading) {
    return <div className="h-16" />;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      <Link
        href="/student/search"
        className="flex shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-gold p-[2px]">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-navy text-lg font-bold text-gold">
            +
          </div>
        </div>
        <span className="max-w-[64px] truncate text-[11px] font-medium text-muted">Find friends</span>
      </Link>

      {friends.length === 0 ? (
        <p className="flex items-center text-sm text-muted">
          No friends yet - search for classmates to add.
        </p>
      ) : (
        friends.map((friend) => (
          <div key={friend.id} className="flex shrink-0 flex-col items-center gap-1.5">
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
          </div>
        ))
      )}
    </div>
  );
}
