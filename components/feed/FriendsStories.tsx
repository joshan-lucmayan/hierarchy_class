"use client";

import { useState } from "react";
import { FRIENDS } from "@/data/friends";

export function FriendsStories() {
  const [activeNote, setActiveNote] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {FRIENDS.map((friend) => (
        <button
          key={friend.id}
          type="button"
          onClick={() => setActiveNote(activeNote === friend.id ? null : friend.id)}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <div className="relative">
            {friend.note && (activeNote === friend.id || friend.isCurrentUser) && (
              <div className="absolute -top-11 left-1/2 z-10 w-max max-w-[140px] -translate-x-1/2 rounded-2xl rounded-bl-sm border border-gold bg-surface px-3 py-1.5 text-[11px] font-medium text-navy shadow-card">
                {friend.note}
              </div>
            )}
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full p-[2px] ${
                friend.isCurrentUser
                  ? "border-2 border-dashed border-gold"
                  : friend.hasUpdate
                  ? "bg-gold"
                  : "bg-[var(--surface-strong)]"
              }`}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-surface bg-navy text-sm font-bold text-gold">
                {friend.isCurrentUser ? "+" : friend.initials}
              </div>
            </div>
          </div>
          <span className="max-w-[64px] truncate text-[11px] font-medium text-muted">{friend.name}</span>
        </button>
      ))}
    </div>
  );
}
