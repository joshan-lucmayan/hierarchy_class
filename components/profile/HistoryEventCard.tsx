"use client";

import type { HistoryEvent } from "@/lib/useHistory";
import type { Rank } from "@/lib/rankEngine";
import { RankTriangle } from "@/components/ui/RankTriangle";
import {
  IconCheck,
  IconTrendDown,
  IconRefresh,
  IconPencil,
} from "@/components/ui/icons";

// ---------------------------------------------------------------------------
// Event metadata
// ---------------------------------------------------------------------------

interface EventMeta {
  badge: string;
  label: string;
  tone: "positive" | "negative" | "neutral" | "promotion" | "demotion" | "season";
}

const EVENT_META: Record<string, EventMeta> = {
  update: { badge: "GRADE", label: "Grade Recorded", tone: "neutral" },
  promotion: { badge: "PROMO", label: "Rank Promotion", tone: "promotion" },
  demotion: { badge: "DROP", label: "Rank Decrease", tone: "demotion" },
  ex_score: { badge: "EX", label: "EX Score Update", tone: "neutral" },
  period_reset: { badge: "PERIOD", label: "New Grading Period", tone: "season" },
  season_reset: { badge: "SEASON", label: "Season Complete", tone: "season" },
  feed_reverted: { badge: "REVERT", label: "Grade Removed", tone: "neutral" },
};

function getEventMeta(eventType: string): EventMeta {
  return EVENT_META[eventType] ?? { badge: "EVENT", label: eventType, tone: "neutral" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function categoryLabel(category: string | null): string | null {
  if (!category) return null;
  const labels: Record<string, string> = {
    quiz: "Quiz",
    exam: "Exam",
    activity: "Activity",
    participation: "Participation",
  };
  return labels[category] ?? category;
}

/** Compute the bar change direction and magnitude. */
function barChangeInfo(
  before: number | null,
  after: number | null,
): { change: number; direction: "up" | "down" | "same" } | null {
  if (before == null || after == null) return null;
  const change = Math.round(after - before);
  return {
    change,
    direction: change > 0 ? "up" : change < 0 ? "down" : "same",
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RankPill({ rank, bar }: { rank: Rank; bar?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RankTriangle rank={rank} size="sm" showLabel={false} />
      <span className="text-sm font-bold text-navy">{rank}</span>
      {bar != null && (
        <span className="text-[11px] text-muted">- {Math.round(bar)}%</span>
      )}
    </span>
  );
}

function RankImpact({
  event,
}: {
  event: HistoryEvent;
}) {
  // EX events show ex_score instead of bar.
  if (event.eventType === "ex_score") {
    const before = event.exScoreBefore ?? 0;
    const after = event.exScoreAfter ?? 0;
    const change = after - before;
    return (
      <div className="mt-3 rounded-[8px] border border-base bg-[var(--surface-strong)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          EX Score
        </p>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span className="font-mono text-navy">{before}</span>
          <span className={`font-semibold ${change >= 0 ? "text-accent-token" : "text-warn"}`}>
            {change >= 0 ? "+" : ""}
            {change}
          </span>
          <span className="font-mono text-navy">{after}</span>
        </div>
      </div>
    );
  }

  // Season reset: show old rank → reset rank.
  if (event.eventType === "season_reset") {
    return (
      <div className="mt-3 rounded-[8px] border border-base bg-[var(--surface-strong)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Rank Reset
        </p>
        <div className="mt-2 flex items-center gap-2">
          {event.rankBefore && <RankPill rank={event.rankBefore} bar={event.barBefore} />}
          <span className="text-xs text-muted">→</span>
          {event.rankAfter && <RankPill rank={event.rankAfter} bar={event.barAfter} />}
        </div>
      </div>
    );
  }

  // Standard rank events (update, promotion, demotion, feed_reverted).
  const hasRank = event.rankBefore || event.rankAfter;
  if (!hasRank) return null;

  const barInfo = barChangeInfo(event.barBefore, event.barAfter);
  const rankChanged = event.rankBefore !== event.rankAfter;

  return (
    <div className="mt-3 rounded-[8px] border border-base bg-[var(--surface-strong)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Rank Impact
      </p>

      {/* Before state */}
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted">Before</span>
        {event.rankBefore && <RankPill rank={event.rankBefore} bar={event.barBefore} />}
      </div>

      {/* Change */}
      {barInfo && barInfo.direction !== "same" && (
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-muted">Change</span>
          <span
            className={`font-semibold ${
              barInfo.direction === "up" ? "text-accent-token" : "text-warn"
            }`}
          >
            {barInfo.direction === "up" ? "+" : ""}
            {barInfo.change}%
          </span>
        </div>
      )}

      {/* Rank transition (promotion/demotion) */}
      {rankChanged && (
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-muted">Now</span>
          <span className="inline-flex items-center gap-1.5">
            {event.rankBefore && (
              <span className="text-xs text-muted line-through">{event.rankBefore}</span>
            )}
            <span className="text-xs text-muted">→</span>
            {event.rankAfter && (
              <span className="font-bold text-navy">{event.rankAfter}</span>
            )}
          </span>
        </div>
      )}

      {/* After state (only when rank didn't change, to avoid redundancy) */}
      {!rankChanged && event.rankAfter && (
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-muted">After</span>
          <RankPill rank={event.rankAfter} bar={event.barAfter} />
        </div>
      )}

      {/* Cascade tiers for demotion */}
      {event.cascadeTiers > 1 && (
        <p className="mt-2 text-[11px] text-warn">
          Dropped {event.cascadeTiers} ranks
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

function EventIcon({ eventType, tone }: { eventType: string; tone: string }) {
  const iconColor = tone === "promotion" || tone === "positive"
    ? "text-accent-token"
    : tone === "demotion" || tone === "negative"
      ? "text-warn"
      : "text-muted";

  const iconMap: Record<string, React.ReactNode> = {
    update: <IconPencil size={13} className={iconColor} />,
    promotion: <IconCheck size={13} className={iconColor} />,
    demotion: <IconTrendDown size={13} className={iconColor} />,
    ex_score: <IconCheck size={13} className={iconColor} />,
    period_reset: <IconRefresh size={13} className={iconColor} />,
    season_reset: <IconRefresh size={13} className={iconColor} />,
    feed_reverted: <IconRefresh size={13} className={iconColor} />,
  };

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-tile">
      {iconMap[eventType] ?? <IconPencil size={13} className="text-muted" />}
    </span>
  );
}

export function HistoryEventCard({ event }: { event: HistoryEvent }) {
  const meta = getEventMeta(event.eventType);

  const toneClasses: Record<string, string> = {
    positive: "border-l-accent",
    negative: "border-l-warn",
    neutral: "border-l-[var(--line)]",
    promotion: "border-l-accent",
    demotion: "border-l-warn",
    season: "border-l-sealion",
  };

  const badgeClasses: Record<string, string> = {
    positive: "bg-accent-soft text-accent-token",
    negative: "bg-warn-soft text-warn",
    neutral: "bg-tile text-muted",
    promotion: "bg-accent-soft text-accent-token",
    demotion: "bg-warn-soft text-warn",
    season: "bg-tile text-sealion",
  };

  return (
    <div
      className={`rounded-[10px] border border-base bg-surface p-4 border-l-[3px] ${
        toneClasses[meta.tone] ?? toneClasses.neutral
      }`}
    >
      {/* Header: icon + badge + title + time */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <EventIcon eventType={event.eventType} tone={meta.tone} />
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${
                  badgeClasses[meta.tone] ?? badgeClasses.neutral
                }`}
              >
                {meta.badge}
              </span>
              <p className="text-sm font-semibold text-navy">{meta.label}</p>
            </div>
            {event.grade?.courseName && (
              <p className="mt-0.5 text-xs text-muted">
                {event.grade.courseName}
                {event.grade.courseCode ? ` (${event.grade.courseCode})` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-muted">{formatTimestamp(event.createdAt)}</p>
        </div>
      </div>

      {/* Academic result (if grade data available) */}
      {event.grade && event.grade.score != null && event.grade.maxScore != null && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-muted">
            {categoryLabel(event.category) ?? event.grade.gradeType}
            {event.grade.gradeLabel ? `: ${event.grade.gradeLabel}` : ""}
          </span>
          <span className="font-semibold text-navy">
            {event.grade.score} / {event.grade.maxScore}
          </span>
        </div>
      )}

      {/* Grade removed (feed_reverted without grade data) */}
      {event.eventType === "feed_reverted" && !event.grade && (
        <p className="mt-2 text-xs text-muted">Source grade no longer available</p>
      )}

      {/* Rank impact */}
      <RankImpact event={event} />

      {/* Date footer */}
      <p className="mt-3 text-[10px] text-faint">{formatDate(event.createdAt)}</p>
    </div>
  );
}
