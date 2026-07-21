"use client";

import { useState } from "react";
import { FRIENDS, Friend } from "@/data/friends";
import { MyDayModal } from "@/components/feed/MyDayModal";

export function FriendsStories() {
  const [viewing, setViewing] = useState<Friend | null>(null);
  const [myNote, setMyNote] = useState(FRIENDS.find((f) => f.isCurrentUser)?.note ?? "");

  function handleTap(friend: Friend) {
    if (friend.dayImage) {
      setViewing(friend);
    }
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {FRIENDS.map((friend) => (
          <button
            key={friend.id}
            type="button"
            onClick={() => handleTap(friend)}
            className="flex shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full p-[2px] ${
                friend.isCurrentUser
                  ? "border-2 border-dashed border-gold"
                  : friend.dayImage
                  ? "bg-gold"
                  : "bg-[var(--surface-strong)]"
              }`}
            >
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-navy text-sm font-bold text-gold">
                {friend.isCurrentUser ? (
                  "+"
                ) : friend.dayImage ? (
                  <img src={friend.dayImage} alt={friend.name} className="h-full w-full object-cover" />
                ) : (
                  <img src="/avatars/default-avatar.webp" alt={friend.name} className="h-full w-full object-cover" />
                )}
              </div>
            </div>
            <span className="max-w-[64px] truncate text-[11px] font-medium text-muted">{friend.name}</span>
          </button>
        ))}
      </div>

      {viewing && (
        <MyDayModal
          name={viewing.name}
          image={viewing.dayImage!}
          note={viewing.isCurrentUser ? myNote : viewing.note ?? ""}
          isOwner={!!viewing.isCurrentUser}
          viewers={viewing.isCurrentUser ? viewing.viewers : undefined}
          onNoteChange={setMyNote}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
