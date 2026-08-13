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
      className="absolute -right-1 -top-1 flex h-2 w-2 items-center justify-center"
    >
      {/* Compact 8px dot - no ping pulse, no oversized ring. */}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface" />
    </span>
  );
}
