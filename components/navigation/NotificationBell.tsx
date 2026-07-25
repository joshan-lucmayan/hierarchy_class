"use client";

import { useEffect, useRef, useState } from "react";
import { ANNOUNCEMENTS } from "@/data/mockStudents";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = ANNOUNCEMENTS.filter((a) => !readIds.includes(a.id)).length;

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
    setReadIds(ANNOUNCEMENTS.map((a) => a.id));
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
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-base bg-surface p-2 shadow-xl">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy">Notifications</p>
          {ANNOUNCEMENTS.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            <div className="space-y-1">
              {ANNOUNCEMENTS.map((a) => (
                <div key={a.id} className="rounded-xl px-3 py-2.5 hover:bg-[var(--surface-strong)]">
                  <p className="text-sm font-semibold text-navy">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
