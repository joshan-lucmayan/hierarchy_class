"use client";

import { useHistory } from "@/lib/useHistory";
import { HistoryEventCard } from "@/components/profile/HistoryEventCard";
import { CornerFrame } from "@/components/ui/CornerFrame";

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

function dateKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface DateGroup {
  label: string;
  events: ReturnType<typeof useHistory>["events"];
}

function groupByDate(events: ReturnType<typeof useHistory>["events"]): DateGroup[] {
  const groups: DateGroup[] = [];
  let currentKey = "";

  for (const event of events) {
    const key = dateKey(event.createdAt);
    if (key !== currentKey) {
      groups.push({ label: key, events: [] });
      currentKey = key;
    }
    groups[groups.length - 1].events.push(event);
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HistoryTimeline({
  studentId,
  viewer = false,
}: {
  studentId?: string;
  viewer?: boolean;
}) {
  const { events, loading, error, hasMore, loadMore } = useHistory(studentId);
  const groups = groupByDate(events);

  // Empty state.
  if (!loading && events.length === 0 && !error) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted">
          {viewer
            ? "No history recorded yet."
            : "No history yet. Your rank progression will appear here once grades are recorded."}
        </p>
      </div>
    );
  }

  // Error state.
  if (error && events.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-warn">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 text-xs font-semibold text-navy underline decoration-accent underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Loading skeleton (initial load only). */}
      {loading && events.length === 0 && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-[10px] border border-base bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 rounded-[8px] bg-tile" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-tile" />
                  <div className="h-2 w-48 rounded bg-tile" />
                </div>
              </div>
              <div className="mt-3 h-16 rounded-[8px] bg-tile" />
            </div>
          ))}
        </div>
      )}

      {/* Event groups. */}
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-faint">
            {group.label}
          </h3>
          <div className="space-y-3">
            {group.events.map((event) => (
              <HistoryEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}

      {/* Load More button. */}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-base bg-surface py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-navy transition hover:border-accent-soft disabled:opacity-60"
        >
          {loading ? "Loading..." : "Load More"}
        </button>
      )}

      {/* Inline error (after initial load). */}
      {error && events.length > 0 && (
        <p className="text-center text-xs text-warn">{error}</p>
      )}
    </div>
  );
}
