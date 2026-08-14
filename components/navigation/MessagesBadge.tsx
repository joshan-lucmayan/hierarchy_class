"use client";

import { useChatStore } from "@/lib/chatStore";

/**
 * Small red dot rendered next to the Messages nav item whenever the signed-in
 * user has unread conversations. It reads the DB-backed unread counts kept in
 * chatStore (which also update in realtime), so it survives reloads and clears
 * once every conversation has been opened/read.
 */
export function MessagesBadge() {
  const { conversations } = useChatStore();
  const unread = conversations.reduce((n, c) => n + (c.unread || 0), 0);
  if (unread === 0) return null;
  return (
    <span
      title={`${unread} unread message${unread === 1 ? "" : "s"}`}
      aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
      className="absolute -right-0.5 -top-0.5 flex h-1.5 w-1.5 items-center justify-center"
    >
      {/* Minimal 6px dot in the palette's salmon tone - no ping pulse, no
          bright red, no ring, sized so it reads as a notification but never
          dominates the 40px nav rail. */}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warn" />
    </span>
  );
}
