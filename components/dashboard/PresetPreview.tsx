"use client";

import * as React from "react";
import { IconPlus } from "@/components/ui/icons";
import type { DashboardPreset, WidgetSize } from "@/lib/dashboardShared";

/**
 * A miniature, non-interactive representation of a Home dashboard, generated
 * from the preset's existing widget definitions - one tile per widget, with
 * the real column span (small=3 / medium=6 / large=9 / full=12 on the same
 * 12-column model the actual dashboard uses) and a double-height tile for
 * `tall`. The canvas mimics the real page (`--bg` backdrop) and each tile is
 * a tiny CornerFrame-style card carrying the real widget label plus a
 * SIMPLIFIED VERSION OF THE WIDGET'S ACTUAL CONTENT - feed tiles show a post
 * with an author line and ADMINISTRATOR badge, class tiles show course rows
 * with averages, grading tiles show stat blocks, attention tiles show alert
 * rows, and so on. This keeps the preview honest (it can never drift from
 * the layout) and makes each preset read as a real dashboard, not a grid of
 * generic rectangles.
 */

/** Column span classes for the mini 12-column preview grid. */
const MINI_SPAN: Record<WidgetSize, string> = {
  small: "col-span-3",
  medium: "col-span-6",
  large: "col-span-9",
  full: "col-span-12",
};

/* ------------------------------------------------------------------ */
/* Tiny building blocks                                                */
/* ------------------------------------------------------------------ */

/** A skeleton line. `tone` defaults to the dark track (bg-tile). */
function Line({ w = "w-3/4", tone = "bg-tile" }: { w?: string; tone?: string }) {
  return <div className={`h-[3px] rounded-full ${tone} ${w}`} />;
}

/** A small filled stat block (the accent tint, like real Stat chips). */
function Stat({ w = "w-[18px]", h = "h-[9px]" }: { w?: string; h?: string }) {
  return <div className={`shrink-0 rounded-[2px] bg-gold-soft ${h} ${w}`} />;
}

/** A tiny bordered chip (status tags, audience pills). */
function Chip({ text, tone = "accent" }: { text: string; tone?: "accent" | "warn" | "plain" }) {
  const cls =
    tone === "warn"
      ? "bg-warn-soft text-warn"
      : tone === "plain"
        ? "bg-tile text-faint"
        : "bg-gold-soft text-gold-token";
  return (
    <span className={`shrink-0 rounded-[2px] px-[3px] py-[1px] text-[4.5px] font-semibold uppercase leading-none tracking-wide ${cls}`}>
      {text}
    </span>
  );
}

/** A tiny avatar circle. */
function Avatar() {
  return <span className="h-2 w-2 shrink-0 rounded-full bg-sealion" />;
}

/** One content row inside a tile. */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="mt-[3px] flex items-center gap-1">{children}</div>;
}

/** Progress bar with an accent fill. */
function Progress({ w = "w-full", fill = "w-3/5" }: { w?: string; fill?: string }) {
  return (
    <div className={`h-[4px] overflow-hidden rounded-full bg-tile ${w}`}>
      <div className={`h-full rounded-full bg-gold-token ${fill}`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Content-aware mini representations                                 */
/* ------------------------------------------------------------------ */

function MiniContent({ id, deep, wide }: { id: string; deep: boolean; wide: boolean }) {
  switch (id) {
    /* School feed - an actual post: author, badge, title, body, tags. */
    case "school-feed":
      return (
        <>
          {deep && (
            <Row>
              <Avatar />
              <Line w="w-1/4" tone="bg-sealion" />
              <Chip text="ADMIN" />
            </Row>
          )}
          <Row>
            <Line w="w-3/5" tone="bg-asphalt" />
          </Row>
          <Row>
            <Line w="w-full" />
          </Row>
          {deep && (
            <>
              <Row>
                <Line w="w-4/5" />
              </Row>
              <Row>
                <Chip text="Announcement" />
                <Chip text="School" tone="plain" />
              </Row>
            </>
          )}
        </>
      );

    /* My Classes - course rows with a small average stat. */
    case "my-classes":
      return (
        <>
          <Row>
            <Line w={wide ? "w-1/2" : "w-2/3"} tone="bg-asphalt" />
            <Stat w={wide ? "w-[16px]" : "w-[12px]"} h="h-[7px]" />
          </Row>
          {deep ? (
            <>
              <Row>
                <Line w="w-2/5" />
                <Stat w="w-[16px]" h="h-[7px]" />
              </Row>
              <Row>
                <Line w="w-1/2" />
                <Stat w="w-[16px]" h="h-[7px]" />
              </Row>
            </>
          ) : (
            <Row>
              <Line w="w-3/5" />
            </Row>
          )}
        </>
      );

    /* Grading Status - submission state stats + a bar. */
    case "grading-status":
      return (
        <>
          <Row>
            <Stat />
            <Stat />
            <Stat />
          </Row>
          <Row>
            <Progress w={wide ? "w-full" : "w-4/5"} />
          </Row>
        </>
      );

    /* Recent submissions - entries with a status chip. */
    case "recent-submissions":
      return (
        <>
          <Row>
            <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
            <Line w="w-1/2" />
            <Chip text="Pending" tone="warn" />
          </Row>
          {deep && (
            <>
              <Row>
                <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
                <Line w="w-2/5" />
                <Chip text="Done" />
              </Row>
              <Row>
                <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
                <Line w="w-3/5" />
              </Row>
            </>
          )}
        </>
      );

    /* Students needing attention / Attention Center - alert rows. */
    case "students-attention":
    case "attention-center":
      return (
        <>
          <Row>
            <span className="h-1 w-1 shrink-0 rounded-full bg-warn" />
            <Line w={wide ? "w-1/2" : "w-3/5"} />
            <Chip text="3" tone="warn" />
          </Row>
          {deep && (
            <>
              <Row>
                <span className="h-1 w-1 shrink-0 rounded-full bg-warn" />
                <Line w="w-2/5" />
                <Chip text="2" tone="warn" />
              </Row>
              <Row>
                <span className="h-1 w-1 shrink-0 rounded-full bg-warn" />
                <Line w="w-1/2" />
                <Chip text="1" tone="warn" />
              </Row>
            </>
          )}
        </>
      );

    /* My Students / Hierarchy Health - rank distribution bars. */
    case "my-students":
    case "hierarchy-health":
      return (
        <>
          <Row>
            <Line w={wide ? "w-4/5" : "w-11/12"} tone="bg-sealion" />
          </Row>
          {deep ? (
            <>
              <Row>
                <Line w="w-3/5" tone="bg-sealion" />
              </Row>
              <Row>
                <Line w="w-2/5" tone="bg-sealion" />
              </Row>
              <Row>
                <Line w="w-1/4" tone="bg-sealion" />
              </Row>
            </>
          ) : (
            <Row>
              <Line w="w-1/2" tone="bg-sealion" />
            </Row>
          )}
        </>
      );

    /* Academic health - program bars with an average. */
    case "academic-health":
      return (
        <>
          <Row>
            <Progress w="w-full" fill="w-4/5" />
          </Row>
          {deep && (
            <>
              <Row>
                <Progress w="w-full" fill="w-3/5" />
              </Row>
              <Row>
                <Stat w="w-[20px]" h="h-[8px]" />
                <Line w="w-1/3" />
              </Row>
            </>
          )}
        </>
      );

    /* Semester progress - the progress visualization. */
    case "semester-progress":
      return (
        <>
          <Row>
            <Line w="w-1/3" />
          </Row>
          <Row>
            <Progress w="w-full" fill="w-3/5" />
          </Row>
          {deep && (
            <Row>
              <Line w="w-1/2" />
              <Chip text="62%" />
            </Row>
          )}
        </>
      );

    /* Grade pipeline - submission stats + a 7-day bar strip. */
    case "grade-pipeline":
      return (
        <>
          <Row>
            <Stat />
            <Stat />
            <Stat />
            <Stat />
          </Row>
          <Row>
            <span className="flex gap-[2px]">
              {[3, 5, 4, 7, 6, 4, 5].map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-gold-soft" style={{ height: `${h}px` }} />
              ))}
            </span>
          </Row>
        </>
      );

    /* Enrollment health - status stats. */
    case "enrollment-health":
      return (
        <>
          <Row>
            <Stat />
            <Stat />
          </Row>
          <Row>
            <Line w="w-2/3" />
          </Row>
        </>
      );

    /* Teacher workload / Teacher tasks / Account requests - person rows. */
    case "teacher-workload":
    case "teacher-tasks":
      return (
        <>
          <Row>
            <Avatar />
            <Line w={wide ? "w-1/2" : "w-3/5"} />
            <Chip text="2" />
          </Row>
          {deep && (
            <>
              <Row>
                <Avatar />
                <Line w="w-2/5" />
                <Chip text="1" tone="warn" />
              </Row>
              <Row>
                <Avatar />
                <Line w="w-1/2" />
              </Row>
            </>
          )}
        </>
      );

    /* Pending grade submissions - teacher + student rows. */
    case "pending-grade-submissions":
      return (
        <>
          <Row>
            <Avatar />
            <Line w="w-2/5" />
            <Chip text="12" />
          </Row>
          {deep && (
            <>
              <Row>
                <Avatar />
                <Line w="w-1/3" />
                <Chip text="8" />
              </Row>
              <Row>
                <Avatar />
                <Line w="w-1/2" />
                <Chip text="5" />
              </Row>
            </>
          )}
        </>
      );

    /* Account requests - name rows with approve/deny mini actions. */
    case "account-requests":
      return (
        <>
          <Row>
            <Avatar />
            <Line w="w-2/5" />
            <span className="h-[7px] w-[7px] rounded-[2px] bg-gold-soft" />
            <span className="h-[7px] w-[7px] rounded-[2px] bg-tile" />
          </Row>
          {deep && (
            <Row>
              <Avatar />
              <Line w="w-1/2" />
              <span className="h-[7px] w-[7px] rounded-[2px] bg-gold-soft" />
              <span className="h-[7px] w-[7px] rounded-[2px] bg-tile" />
            </Row>
          )}
        </>
      );

    /* Recent activity - event rows. */
    case "recent-activity":
      return (
        <>
          <Row>
            <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
            <Chip text="Approved" />
            <Line w="w-1/2" />
          </Row>
          {deep && (
            <>
              <Row>
                <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
                <Chip text="Assigned" tone="plain" />
                <Line w="w-2/5" />
              </Row>
              <Row>
                <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
                <Chip text="Pending" tone="warn" />
                <Line w="w-1/2" />
              </Row>
            </>
          )}
        </>
      );

    /* Today's schedule / lesson plans - time + subject rows. */
    case "today-schedule":
    case "today-lessons":
    case "upcoming-lessons":
      return (
        <>
          <Row>
            <Chip text="8:00" tone="plain" />
            <Line w={wide ? "w-2/3" : "w-4/5"} tone="bg-asphalt" />
          </Row>
          {deep && (
            <Row>
              <Chip text="10:00" tone="plain" />
              <Line w="w-1/2" />
            </Row>
          )}
        </>
      );

    /* Pinned notes - note lines. */
    case "pinned-notes":
      return (
        <>
          <Row>
            <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
            <Line w="w-4/5" />
          </Row>
          {deep && (
            <Row>
              <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
              <Line w="w-3/5" />
            </Row>
          )}
        </>
      );

    /* Teaching state - today's load stats. */
    case "teaching-state":
      return (
        <>
          <Row>
            <Stat />
            <Stat />
          </Row>
          <Row>
            <Line w="w-3/4" />
          </Row>
        </>
      );

    /* School snapshot - a 2x2 stat grid. */
    case "school-snapshot":
      return (
        <>
          <Row>
            <Stat w="w-full" h="h-[8px]" />
          </Row>
          <Row>
            <Stat w="w-full" h="h-[8px]" />
          </Row>
        </>
      );

    /* Unknown widget - generic placeholder lines. */
    default:
      return (
        <>
          <Row>
            <Line w="w-3/4" />
          </Row>
          {deep && <Row>
            <Line w="w-1/2" />
          </Row>}
        </>
      );
  }
}

/* ------------------------------------------------------------------ */
/* The preview                                                         */
/* ------------------------------------------------------------------ */

export function PresetPreview({
  widgets,
  labelOf,
  blank = false,
}: {
  widgets: DashboardPreset["widgets"];
  labelOf: (id: string) => string | undefined;
  /** Renders the empty-dashboard variant (Customize yourself). */
  blank?: boolean;
}) {
  if (blank) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-[10px] border border-dashed border-line bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-base bg-surface text-gold-token">
            <IconPlus size={15} />
          </span>
          <p className="font-mono-ui text-[8px] font-medium uppercase tracking-[0.18em] text-faint">
            Blank Home
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-base bg-[var(--bg)] p-2">
      <div className="grid grid-cols-12 gap-1 auto-rows-[28px]">
        {widgets.map((w, i) => {
          const label = labelOf(w.id);
          const deep = w.tall;
          const wide = w.size === "large" || w.size === "full";
          return (
            <div
              key={i}
              className={`${MINI_SPAN[w.size]} ${
                w.tall ? "row-span-2" : ""
              } min-h-0 overflow-hidden rounded-[4px] border border-base bg-surface px-1.5 py-1`}
            >
              {/* Mini card header - accent dot + the real widget label */}
              <div className="flex items-center gap-1">
                <span className="h-1 w-1 shrink-0 rounded-full bg-gold-token" />
                <p className="min-w-0 flex-1 truncate text-[6.5px] font-semibold uppercase tracking-[0.06em] text-navy">
                  {label ?? "Widget"}
                </p>
              </div>
              {/* Simplified representation of the widget's real content */}
              {w.size !== "small" && <MiniContent id={w.id} deep={deep} wide={wide} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
