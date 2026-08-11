"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationsStore";

const TYPE_DOT: Record<string, string> = {
  announcement: "bg-gold",
  message: "bg-blue-500",
  task: "bg-purple-500",
  grade: "bg-emerald-500",
  friend: "bg-pink-500",
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
  const { notifications, unreadCount, loading, error, markAllRead } = useNotifications();

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
    setIsOpen((prev) => !prev);
    if (!isOpen && unreadCount > 0) {
      markAllRead();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-base bg-surface text-navy transition hover:border-gold"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-base bg-surface p-2 shadow-xl">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy">Notifications</p>
          {loading ? (
            <p className="px-3 py-4 text-sm text-muted">Loading...</p>
          ) : error ? (
            <p className="px-3 py-4 text-sm text-red-500">{error}</p>
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
                const inner = (
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[n.type] ?? TYPE_DOT.system}`} />
                    <div className="min-w-0 flex-1">{body}</div>
                  </div>
                );
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => setIsOpen(false)}
                    className="block rounded-xl px-3 py-2.5 hover:bg-[var(--surface-strong)]"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className="rounded-xl px-3 py-2.5 hover:bg-[var(--surface-strong)]">
                    {inner}
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
