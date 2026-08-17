"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import {
  WIDGET_SIZES,
  SIZE_COLUMNS,
  DEFAULT_WIDGET_SIZE,
  type WidgetSize,
  type DashboardWidgetDef,
  type DashboardPreset,
} from "@/lib/dashboardShared";

// Re-exported for callers of the teacher store (WidgetTile, tests, etc.).
export { WIDGET_SIZES, SIZE_COLUMNS, DEFAULT_WIDGET_SIZE, SPAN_CLASS } from "@/lib/dashboardShared";
export type { WidgetSize } from "@/lib/dashboardShared";

/**
 * Teacher Home personal dashboard preferences.
 *
 * PRESENTATION-ONLY: which widgets a teacher placed on their Home and how
 * those tiles are arranged. It stores no academic data, no permissions and
 * no metrics - every tile renders a projection of data that already exists
 * in the app-level providers (classroom hierarchy, ranks, tasks, workspace,
 * school feed).
 *
 * LAYOUT MODEL - structured dashboard (not a free-form canvas). Stored in
 * the `teacher_dashboard_prefs.layout` JSONB column:
 *
 *   { "widgets": [ { "id": "grading-status", "size": "medium", "tall": false, "order": 0 } ] }
 *
 * The teacher controls WHICH widgets exist, their ORDER, and their SIZE.
 * The layout engine (CSS Grid, 12 columns on desktop, 1 column on mobile)
 * decides POSITION - no x/y coordinates are ever saved. A tile's size maps
 * to a column span: small = 3, medium = 6, large = 9, full = 12. `tall`
 * maps to a 2-row span. CSS Grid flows widgets row by row in saved order;
 * a widget that does not fit the current row simply starts the next one.
 *
 * A teacher with no saved layout (or a legacy `{hidden, order}` row from
 * the first-generation customizer) gets an EMPTY dashboard - the Home is
 * theirs to build. No developer-defined default exists.
 *
 * The table itself needed no migration: the JSONB column is app-defined, so
 * only the shape and normalization changed.
 */

export type WidgetDef = DashboardWidgetDef;

/** Every widget the Home supports. All are projections of existing data. */
export const HOME_WIDGETS: WidgetDef[] = [
  {
    id: "teaching-state",
    label: "Teaching State",
    description: "A snapshot of today's load: classes, courses, students, pending work.",
  },
  {
    id: "my-classes",
    label: "My Classes",
    description: "Your assigned courses with section, students, and class average.",
  },
  {
    id: "grading-status",
    label: "Grading Status",
    description: "Your submissions by approval state and students without grades.",
  },
  {
    id: "recent-submissions",
    label: "Recent Submissions",
    description: "Your latest grade entries and their approval status.",
  },
  {
    id: "students-attention",
    label: "Students Needing Attention",
    description: "Students whose recent grades are trending down.",
  },
  {
    id: "my-students",
    label: "My Students",
    description: "Rank distribution across your own students.",
  },
  {
    id: "school-feed",
    label: "School Feed",
    description: "Latest announcements and posts from the school.",
  },
  {
    id: "assigned-tasks",
    label: "Assigned Tasks",
    description: "Tasks assigned by admin - accept, decline, mark done.",
  },
  {
    id: "today-schedule",
    label: "Today's Schedule",
    description: "What's left on your schedule today. Opens the Workspace schedule.",
  },
  {
    id: "today-lessons",
    label: "Today's Lesson Plans",
    description: "Lesson plans for today. Opens the Workspace lesson plans.",
  },
  {
    id: "pinned-notes",
    label: "Pinned Notes",
    description: "Notes you've pinned. Opens the Workspace notes.",
  },
  {
    id: "upcoming-lessons",
    label: "Upcoming Lesson Plans",
    description: "Your next upcoming lesson plans. Opens the Workspace.",
  },
];

export const WIDGET_BY_ID: Record<string, WidgetDef> = Object.fromEntries(
  HOME_WIDGETS.map((w) => [w.id, w])
);

/* ------------------------------------------------------------------ */
/* Developer presets                                                    */
/* ------------------------------------------------------------------ */

/**
 * Developer-created starting arrangements. A preset is never applied
 * automatically - the teacher picks it inside the customizer, it loads into
 * the draft, and it only becomes their Home after Save. All widgets are
 * existing HOME_WIDGETS entries; no new data sources.
 */
export const TEACHER_PRESETS: DashboardPreset[] = [
  /* Every preset is composed so each 12-column row is fully occupied - no
   * dead space - with the hero widget getting the most height. Sizes are
   * content-aware: feeds and attention lists get `tall`, stat widgets sit
   * in the 3-column rails, class/grading panels pair as 9+3 or 6+6. */
  {
    id: "daily-focus",
    label: "Daily Focus",
    description: "Today's feed, grading, and classes in one view.",
    widgets: [
      { id: "school-feed", size: "full", tall: true },
      { id: "grading-status", size: "medium", tall: false },
      { id: "my-classes", size: "medium", tall: false },
      { id: "recent-submissions", size: "medium", tall: false },
      { id: "teaching-state", size: "medium", tall: false },
    ],
  },
  {
    id: "class-overview",
    label: "Class Overview",
    description: "Classes, students, and grading at a glance.",
    widgets: [
      { id: "my-classes", size: "large", tall: false },
      { id: "students-attention", size: "small", tall: false },
      { id: "my-students", size: "medium", tall: false },
      { id: "grading-status", size: "medium", tall: false },
      { id: "recent-submissions", size: "full", tall: false },
    ],
  },
  {
    id: "grading-focus",
    label: "Grading Focus",
    description: "Grading and submissions front and center.",
    widgets: [
      { id: "grading-status", size: "large", tall: false },
      { id: "students-attention", size: "small", tall: false },
      { id: "recent-submissions", size: "large", tall: false },
      { id: "teaching-state", size: "small", tall: false },
      { id: "my-classes", size: "medium", tall: false },
      { id: "assigned-tasks", size: "medium", tall: false },
    ],
  },
  {
    id: "teaching-day",
    label: "Teaching Day",
    description: "Your schedule, lessons, and plan for the day.",
    widgets: [
      { id: "today-schedule", size: "medium", tall: false },
      { id: "today-lessons", size: "medium", tall: false },
      { id: "my-classes", size: "large", tall: false },
      { id: "pinned-notes", size: "small", tall: false },
      { id: "upcoming-lessons", size: "medium", tall: false },
      { id: "assigned-tasks", size: "medium", tall: false },
    ],
  },
  {
    id: "student-attention",
    label: "Student Attention",
    description: "Students who need you, with your rosters beside them.",
    widgets: [
      { id: "students-attention", size: "large", tall: true },
      { id: "my-students", size: "small", tall: true },
      { id: "grading-status", size: "medium", tall: false },
      { id: "my-classes", size: "medium", tall: false },
      { id: "recent-submissions", size: "medium", tall: false },
      { id: "assigned-tasks", size: "medium", tall: false },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    description: "School posts, announcements, and daily updates.",
    widgets: [
      { id: "school-feed", size: "large", tall: true },
      { id: "pinned-notes", size: "small", tall: true },
      { id: "assigned-tasks", size: "medium", tall: false },
      { id: "recent-submissions", size: "medium", tall: false },
      { id: "my-classes", size: "full", tall: false },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Structured placement                                                */
/* ------------------------------------------------------------------ */

/** One widget tile on the dashboard: identity, size, and row span only. */
export interface TeacherWidgetPlacement {
  id: string;
  size: WidgetSize;
  tall: boolean;
  /** Display order (0-based). Kept in sync with array position on save. */
  order: number;
}

export interface TeacherDashboardPrefs {
  widgets: TeacherWidgetPlacement[];
}

export const EMPTY_HOME_PREFS: TeacherDashboardPrefs = { widgets: [] };

function isWidgetSize(v: unknown): v is WidgetSize {
  return typeof v === "string" && (WIDGET_SIZES as string[]).includes(v);
}

/** Free-form column width -> nearest allowed size (small=3 … full=12). */
function columnsToSize(w: number): WidgetSize {
  if (w <= 3) return "small";
  if (w <= 6) return "medium";
  if (w <= 9) return "large";
  return "full";
}

/** Free-form row height -> tall (roughly doubled rows = tall). */
function rowsToTall(h: number): boolean {
  return Number.isFinite(h) && h >= 7;
}

function normalizePlacement(raw: unknown): TeacherWidgetPlacement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id || !WIDGET_BY_ID[id]) return null;
  const size = isWidgetSize(o.size) ? o.size : DEFAULT_WIDGET_SIZE;
  const tall = o.tall === true || o.tall === "true" || o.tall === 1;
  const order = typeof o.order === "number" && Number.isFinite(o.order) ? Math.max(0, Math.round(o.order)) : 0;
  return { id, size, tall, order };
}

/** Converts a single legacy placement (free-form or preset-era) to the new shape. */
function legacyToPlacement(raw: unknown): TeacherWidgetPlacement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id || !WIDGET_BY_ID[id]) return null;
  if (typeof o.x === "number" && typeof o.w === "number") {
    // Free-form grid era: {id, x, y, w, h} -> size from width, tall from height.
    return {
      id,
      size: columnsToSize(o.w),
      tall: rowsToTall(typeof o.h === "number" ? o.h : 0),
      order: typeof o.order === "number" ? o.order : 0,
    };
  }
  // Preset era: {id, size, tall, order} (or missing size -> default).
  const size = isWidgetSize(o.size) ? o.size : DEFAULT_WIDGET_SIZE;
  const tall = o.tall === true || o.tall === "true" || o.tall === 1;
  const order = typeof o.order === "number" && Number.isFinite(o.order) ? Math.max(0, Math.round(o.order)) : 0;
  return { id, size, tall, order };
}

/** Re-indexes order to array position after any mutation. */
function reindex(widgets: TeacherWidgetPlacement[]): TeacherWidgetPlacement[] {
  return widgets.map((w, i) => ({ ...w, order: i }));
}

/**
 * Migrates ANY saved shape into the structured placement list:
 * - the current shape `{widgets: [{id,size,tall,order}]}`: validated,
 * - the free-form era `{widgets: [{id,x,y,w,h}]}`: size from width, tall
 *   from height (your existing arrangement is preserved visually),
 * - the preset era `{widgets: [{id,size,order}]}`: kept directly,
 * - the i3 BSP tree `{root: {...}}`: each leaf's region becomes a placement,
 * - legacy `{hidden, order}` / unknown shapes: empty dashboard.
 * Unknown widgets are dropped, duplicates keep their first occurrence, and
 * invalid sizes fall back to the safe default. Never throws - a bad row
 * simply renders an empty Home.
 */
export function normalizeHomePrefs(raw: unknown): TeacherDashboardPrefs {
  if (!raw || typeof raw !== "object") return EMPTY_HOME_PREFS;
  const obj = raw as Record<string, unknown>;

  const collect = (items: unknown[]): TeacherDashboardPrefs => {
    const out: TeacherWidgetPlacement[] = [];
    const seen = new Set<string>();
    items.forEach((item, idx) => {
      const n = legacyToPlacement(item) ?? normalizePlacement(item);
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      out.push({ ...n, order: Number.isFinite(n.order) ? n.order : idx });
    });
    out.sort((a, b) => a.order - b.order);
    return { widgets: reindex(out) };
  };

  // BSP tree shape from the split-tree pass.
  if (obj.root !== undefined) {
    const leaves: unknown[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.type === "leaf") {
        leaves.push(o);
      } else if (o.type === "split") {
        walk(o.a);
        walk(o.b);
      }
    };
    walk(obj.root);
    return collect(leaves);
  }

  if (Array.isArray(obj.widgets)) {
    return collect(obj.widgets);
  }

  // Legacy {hidden, order} and everything else: empty dashboard.
  return EMPTY_HOME_PREFS;
}

/* ------------------------------------------------------------------ */
/* Draft operations (pure - return a NEW array)                        */
/* ------------------------------------------------------------------ */

/** Adds a widget at the end of the dashboard order (default medium). */
export function addWidgetPlacement(
  widgets: TeacherWidgetPlacement[],
  id: string
): TeacherWidgetPlacement[] {
  if (!WIDGET_BY_ID[id] || widgets.some((w) => w.id === id)) return widgets;
  return reindex([...widgets, { id, size: DEFAULT_WIDGET_SIZE, tall: false, order: widgets.length }]);
}

/** Removes a widget from the dashboard layout. NEVER touches its data. */
export function removeWidgetPlacement(
  widgets: TeacherWidgetPlacement[],
  id: string
): TeacherWidgetPlacement[] {
  return reindex(widgets.filter((w) => w.id !== id));
}

/** Moves `id` to the position of `targetId` (dnd-kit arrayMove semantics). */
export function reorderWidgetPlacement(
  widgets: TeacherWidgetPlacement[],
  id: string,
  targetId: string
): TeacherWidgetPlacement[] {
  if (id === targetId) return widgets;
  const from = widgets.findIndex((w) => w.id === id);
  const to = widgets.findIndex((w) => w.id === targetId);
  if (from < 0 || to < 0) return widgets;
  const next = [...widgets];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return reindex(next);
}

/** Changes a widget's size (small/medium/large/full). */
export function setWidgetSize(
  widgets: TeacherWidgetPlacement[],
  id: string,
  size: WidgetSize
): TeacherWidgetPlacement[] {
  return widgets.map((w) => (w.id === id ? { ...w, size } : w));
}

/** Changes a widget's row-span (tall). */
export function setWidgetTall(
  widgets: TeacherWidgetPlacement[],
  id: string,
  tall: boolean
): TeacherWidgetPlacement[] {
  return widgets.map((w) => (w.id === id ? { ...w, tall } : w));
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

interface TeacherPrefsContextValue {
  prefs: TeacherDashboardPrefs;
  loading: boolean;
  error: string | null;
  savePrefs: (prefs: TeacherDashboardPrefs) => Promise<void>;
  /** Removes the row entirely - the teacher's Home returns to empty. */
  resetPrefs: () => Promise<void>;
}

const TeacherPrefsContext = createContext<TeacherPrefsContextValue | null>(null);

export function TeacherPrefsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [prefs, setPrefs] = useState<TeacherDashboardPrefs>(EMPTY_HOME_PREFS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();

    (supabase.from("teacher_dashboard_prefs") as any)
      .select("layout")
      .eq("teacher_id", profile.id)
      .maybeSingle()
      .then(({ data, error: fetchError }: { data: any; error: unknown }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load your Home layout.");
        } else {
          // JSONB comes back as an already-parsed object; normalize whatever
          // shape we actually got (missing row -> empty dashboard).
          setPrefs(normalizeHomePrefs(data?.layout ?? null));
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  /** Optimistically applies the layout, then upserts the single row. */
  const savePrefs = useCallback(
    async (next: TeacherDashboardPrefs) => {
      const normalized = normalizeHomePrefs(next);
      setPrefs(normalized);
      if (!profile) return;
      const { error: writeError } = await (createClient().from("teacher_dashboard_prefs") as any).upsert(
        {
          school_id: profile.school_id,
          teacher_id: profile.id,
          layout: { widgets: normalized.widgets },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "teacher_id" }
      );
      if (writeError) {
        setError("Couldn't save your Home layout.");
        refetch();
      } else {
        setError(null);
      }
    },
    [profile, refetch]
  );

  /** Optimistically clears Home and removes the row. Never touches data. */
  const resetPrefs = useCallback(async () => {
    setPrefs(EMPTY_HOME_PREFS);
    if (!profile) return;
    const { error: writeError } = await (createClient().from("teacher_dashboard_prefs") as any)
      .delete()
      .eq("teacher_id", profile.id);
    if (writeError) {
      setError("Couldn't clear your Home layout.");
      refetch();
    } else {
      setError(null);
    }
  }, [profile, refetch]);

  return (
    <TeacherPrefsContext.Provider value={{ prefs, loading, error, savePrefs, resetPrefs }}>
      {children}
    </TeacherPrefsContext.Provider>
  );
}

export function useTeacherPrefs() {
  const ctx = useContext(TeacherPrefsContext);
  if (!ctx) throw new Error("useTeacherPrefs must be used within TeacherPrefsProvider");
  return ctx;
}
