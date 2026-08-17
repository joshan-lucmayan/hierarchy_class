"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationsStore";

const TYPE_DOT: Record<string, string> = {
  announcement: "bg-gold-token",
  message: "bg-sealion",
  task: "bg-purple-500",
  grade: "bg-gold-token",
  friend: "bg-[var(--warn-fill)]",
  system: "bg-gray-400",
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, error, markRead, markAllRead, clearAll } = useNotifications();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen() {
    // Opening the dropdown never marks anything read - the badge only drops
    // when the user explicitly marks notifications read.
    setIsOpen((prev) => !prev);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-tile text-muted transition hover:border-sealion"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-warn ring-[1.5px] ring-surface" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-[10px] border border-base bg-surface p-2 shadow-xl">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-navy">Notifications</p>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllRead()}
                      className="rounded-full border border-base px-2.5 py-1 text-[10px] font-semibold text-muted transition hover:border-gold hover:text-navy"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => clearAll()}
                    className="rounded-full border border-base px-2.5 py-1 text-[10px] font-semibold text-muted transition hover-border-warn-soft hover-text-warn"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
          {loading ? (
            <p className="px-3 py-4 text-sm text-muted">Loading...</p>
          ) : error ? (
            <p className="px-3 py-4 text-sm text-warn">{error}</p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {notifications.map((n) => {
                const body = (
                  <>
                    <p className="text-sm font-semibold text-navy">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-[10px] text-muted">{timeAgo(n.created_at)}</p>
                  </>
                );
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 hover:bg-[var(--surface-strong)] ${
                      isUnread ? "bg-[var(--surface-strong)]/60" : ""
                    }`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? TYPE_DOT[n.type] ?? TYPE_DOT.system : "bg-[var(--border)]"}`} />
                    <div className="min-w-0 flex-1">
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (isUnread) markRead(n.id);
                            setIsOpen(false);
                          }}
                          className="block"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div onClick={() => isUnread && markRead(n.id)}>{body}</div>
                      )}
                    </div>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        title="Mark as read"
                        aria-label="Mark as read"
                        className="mt-0.5 shrink-0 rounded-full border border-base p-1 text-muted transition hover:border-gold hover:text-navy"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
