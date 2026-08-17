"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import {
  WIDGET_SIZES,
  DEFAULT_WIDGET_SIZE,
  type WidgetSize,
  type DashboardWidgetDef,
  type DashboardPreset,
} from "@/lib/dashboardShared";

/**
 * Admin Home dashboard preferences.
 *
 * PRESENTATION-ONLY: which school-wide widgets an admin places on their Home
 * and how those tiles are arranged. It stores no academic data, no
 * permissions and no metrics - every tile renders a projection of data that
 * already exists in the app-level providers (classroom hierarchy, ranks,
 * tasks, enrollment, posts, account requests).
 *
 * LAYOUT MODEL - the same structured dashboard as Teacher Home (not a
 * free-form canvas). Stored in the `admin_dashboard_prefs.layout` JSONB
 * column:
 *
 *   { "widgets": [ { "id": "school-snapshot", "size": "medium", "tall": false, "order": 0 } ] }
 *
 * The admin controls WHICH widgets exist, their ORDER, and their SIZE. The
 * layout engine (CSS Grid, 12 columns on desktop, 1 column on mobile)
 * decides POSITION - no x/y coordinates are ever saved. A tile's size maps
 * to a column span: small = 3, medium = 6, large = 9, full = 12. `tall`
 * maps to a 2-row span.
 *
 * EMPTY BY DEFAULT: like Teacher Home, Admin Home starts empty. There is
 * NO developer-forced default arrangement - an admin with no saved row (or
 * a malformed one) sees the empty command-center state and builds their
 * own dashboard, optionally starting from a developer-created preset
 * (ADMIN_PRESETS). A VALID saved layout is authoritative. Presets are
 * never applied automatically; selecting one only loads it into the draft
 * until Save.
 */

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export interface AdminWidgetDef extends DashboardWidgetDef {}

export const ADMIN_WIDGETS: AdminWidgetDef[] = [
  /* PRODUCT DECISION: every admin widget supports ALL four sizes
     (small = 3 / medium = 6 / large = 9 / full = 12 columns). The widget
     content adapts to the card; nothing is locked to a minimum size.
     defaultSize is only what a freshly added widget starts at. */
  {
    id: "semester-progress",
    label: "Semester Progress",
    description: "The current season window - how far along it is and when it ends.",
    defaultSize: "medium",
  },
  {
    id: "school-snapshot",
    label: "School Snapshot",
    description: "Students, teachers, courses, sections, and programs at a glance.",
    defaultSize: "medium",
  },
  {
    id: "hierarchy-health",
    label: "Hierarchy Health",
    description: "The school-wide rank distribution plus season-over-season progression.",
    defaultSize: "medium",
  },
  {
    id: "academic-health",
    label: "Academic Health",
    description: "Program averages from approved grades, weighted by course categories.",
    defaultSize: "medium",
  },
  {
    id: "attention-center",
    label: "Attention Center",
    description: "Everything actionable right now: pending grades, expiring enrollments, requests, overdue tasks.",
    defaultSize: "full",
  },
  {
    id: "grade-pipeline",
    label: "Grade Pipeline",
    description: "Submission volume, approval rate, oldest pending, and last 7 days.",
    defaultSize: "medium",
  },
  {
    id: "enrollment-health",
    label: "Enrollment Health",
    description: "Active, expired, revoked, and expiring-soon enrollments.",
    defaultSize: "medium",
  },
  {
    id: "teacher-workload",
    label: "Teacher Workload",
    description: "Open and pending tasks per teacher, plus overdue count.",
    defaultSize: "medium",
  },
  {
    id: "pending-grade-submissions",
    label: "Pending Grade Submissions",
    description: "Teacher submissions awaiting your approval - approve or reject from Home.",
    defaultSize: "large",
  },
  {
    id: "account-requests",
    label: "Account Requests",
    description: "Deactivation and deletion requests awaiting your decision.",
    defaultSize: "medium",
  },
  {
    id: "teacher-tasks",
    label: "Teacher Tasks Awaiting Action",
    description: "Assigned tasks that teachers have not answered yet.",
    defaultSize: "medium",
  },
  {
    id: "recent-activity",
    label: "Recent Activity",
    description: "The latest grade and task events across the school.",
    defaultSize: "medium",
  },
  {
    id: "school-feed",
    label: "School Feed & Announcements",
    description: "Manage the school posts and announcements shown to students and teachers.",
    defaultSize: "full",
  },
];

export const ADMIN_WIDGET_BY_ID: Record<string, AdminWidgetDef> = Object.fromEntries(
  ADMIN_WIDGETS.map((w) => [w.id, w])
);

/* ------------------------------------------------------------------ */
/* Structured placement + default layout                               */
/* ------------------------------------------------------------------ */

/** One widget tile on the dashboard: identity, size, and row span only. */
export interface AdminWidgetPlacement {
  id: string;
  size: WidgetSize;
  tall: boolean;
  /** Display order (0-based). Kept in sync with array position on save. */
  order: number;
}

export interface AdminDashboardPrefs {
  widgets: AdminWidgetPlacement[];
}

/** A fresh admin's Home: empty until they build or apply a preset. */
export const EMPTY_ADMIN_PREFS: AdminDashboardPrefs = { widgets: [] };

/**
 * Developer-created starting arrangements. A preset is never applied
 * automatically - the admin picks it inside the customizer, it loads into
 * the draft, and it only becomes their Home after Save. All widgets are
 * existing ADMIN_WIDGETS entries; no new data sources.
 */
export const ADMIN_PRESETS: DashboardPreset[] = [
  /* Every preset is composed so each 12-column row is fully occupied - no
   * dead space - with the hero widget getting the most height. Sizes are
   * content-aware and respect each widget's allowedSizes: feeds and the
   * attention center get `full`/`tall`, decision queues pair as 6+6 or
   * large+small (the small-capable stat widgets fill the 3-column rails). */
  {
    id: "school-operations",
    label: "School Operations",
    description: "Attention, pipelines, and the workflow queues that need you.",
    widgets: [
      { id: "attention-center", size: "full", tall: true },
      { id: "pending-grade-submissions", size: "large", tall: false },
      { id: "grade-pipeline", size: "small", tall: false },
      { id: "enrollment-health", size: "medium", tall: false },
      { id: "account-requests", size: "medium", tall: false },
      { id: "teacher-workload", size: "medium", tall: false },
      { id: "teacher-tasks", size: "medium", tall: false },
    ],
  },
  {
    id: "academic-overview",
    label: "Academic Overview",
    description: "Semester, snapshot, and school-wide academic health.",
    widgets: [
      { id: "semester-progress", size: "medium", tall: false },
      { id: "school-snapshot", size: "medium", tall: false },
      { id: "hierarchy-health", size: "medium", tall: true },
      { id: "academic-health", size: "medium", tall: true },
      { id: "grade-pipeline", size: "medium", tall: false },
      { id: "recent-activity", size: "medium", tall: false },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    description: "Feed, announcements, and the people queues.",
    widgets: [
      { id: "school-feed", size: "full", tall: true },
      { id: "attention-center", size: "medium", tall: false },
      { id: "recent-activity", size: "medium", tall: false },
      { id: "teacher-tasks", size: "medium", tall: false },
      { id: "account-requests", size: "medium", tall: false },
    ],
  },
  {
    id: "administration-focus",
    label: "Administration Focus",
    description: "The queues that need your decision.",
    widgets: [
      { id: "pending-grade-submissions", size: "large", tall: false },
      { id: "grade-pipeline", size: "small", tall: false },
      { id: "attention-center", size: "medium", tall: false },
      { id: "account-requests", size: "medium", tall: false },
      { id: "teacher-workload", size: "medium", tall: false },
      { id: "teacher-tasks", size: "medium", tall: false },
    ],
  },
  {
    id: "academic-health",
    label: "Academic Health",
    description: "School-wide academic performance.",
    widgets: [
      { id: "academic-health", size: "medium", tall: false },
      { id: "hierarchy-health", size: "medium", tall: false },
      { id: "grade-pipeline", size: "full", tall: false },
      { id: "semester-progress", size: "medium", tall: false },
      { id: "school-snapshot", size: "medium", tall: false },
    ],
  },
  {
    id: "school-communication",
    label: "School Communication",
    description: "Posts, announcements, and school activity.",
    widgets: [
      { id: "school-feed", size: "large", tall: true },
      { id: "school-snapshot", size: "small", tall: true },
      { id: "attention-center", size: "medium", tall: false },
      { id: "teacher-tasks", size: "medium", tall: false },
      { id: "recent-activity", size: "full", tall: false },
    ],
  },
];

function isWidgetSize(v: unknown): v is WidgetSize {
  return typeof v === "string" && (WIDGET_SIZES as string[]).includes(v);
}

/** The sizes a given widget actually supports (registry or all four). */
function allowedSizesFor(id: string): WidgetSize[] {
  return ADMIN_WIDGET_BY_ID[id]?.sizes ?? WIDGET_SIZES;
}

function defaultSizeFor(id: string): WidgetSize {
  return ADMIN_WIDGET_BY_ID[id]?.defaultSize ?? DEFAULT_WIDGET_SIZE;
}

function normalizePlacement(raw: unknown): AdminWidgetPlacement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id || !ADMIN_WIDGET_BY_ID[id]) return null;
  const allowed = allowedSizesFor(id);
  const size = isWidgetSize(o.size) && allowed.includes(o.size) ? o.size : defaultSizeFor(id);
  const tall = o.tall === true || o.tall === "true" || o.tall === 1;
  const order = typeof o.order === "number" && Number.isFinite(o.order) ? Math.max(0, Math.round(o.order)) : 0;
  return { id, size, tall, order };
}

/** Re-indexes order to array position after any mutation. */
function reindex(widgets: AdminWidgetPlacement[]): AdminWidgetPlacement[] {
  return widgets.map((w, i) => ({ ...w, order: i }));
}

/**
 * Normalizes any saved shape into the validated placement list. A VALID
 * `{widgets: [...]}` is authoritative. Unknown widgets are dropped,
 * duplicates keep their first occurrence, invalid sizes fall back to the
 * widget's default. Anything malformed (or a missing row) yields an EMPTY
 * dashboard - Admin Home is empty by default, never a developer-forced
 * arrangement.
 */
export function normalizeAdminPrefs(raw: unknown): AdminDashboardPrefs {
  if (!raw || typeof raw !== "object") return EMPTY_ADMIN_PREFS;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.widgets)) {
    const out: AdminWidgetPlacement[] = [];
    const seen = new Set<string>();
    obj.widgets.forEach((item, idx) => {
      const n = normalizePlacement(item);
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      out.push({ ...n, order: Number.isFinite(n.order) ? n.order : idx });
    });
    out.sort((a, b) => a.order - b.order);
    return { widgets: reindex(out) };
  }
  return EMPTY_ADMIN_PREFS;
}

/* ------------------------------------------------------------------ */
/* Draft operations (pure - return a NEW array)                        */
/* ------------------------------------------------------------------ */

/** Adds a widget at the end of the dashboard order (its registry default). */
export function addWidgetPlacement(
  widgets: AdminWidgetPlacement[],
  id: string
): AdminWidgetPlacement[] {
  if (!ADMIN_WIDGET_BY_ID[id] || widgets.some((w) => w.id === id)) return widgets;
  return reindex([
    ...widgets,
    { id, size: defaultSizeFor(id), tall: false, order: widgets.length },
  ]);
}

/** Removes a widget from the dashboard layout. NEVER touches its data. */
export function removeWidgetPlacement(
  widgets: AdminWidgetPlacement[],
  id: string
): AdminWidgetPlacement[] {
  return reindex(widgets.filter((w) => w.id !== id));
}

/** Moves `id` to the position of `targetId` (dnd-kit arrayMove semantics). */
export function reorderWidgetPlacement(
  widgets: AdminWidgetPlacement[],
  id: string,
  targetId: string
): AdminWidgetPlacement[] {
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
  widgets: AdminWidgetPlacement[],
  id: string,
  size: WidgetSize
): AdminWidgetPlacement[] {
  return widgets.map((w) => (w.id === id ? { ...w, size } : w));
}

/** Changes a widget's row-span (tall). */
export function setWidgetTall(
  widgets: AdminWidgetPlacement[],
  id: string,
  tall: boolean
): AdminWidgetPlacement[] {
  return widgets.map((w) => (w.id === id ? { ...w, tall } : w));
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

interface AdminPrefsContextValue {
  prefs: AdminDashboardPrefs;
  loading: boolean;
  error: string | null;
  savePrefs: (prefs: AdminDashboardPrefs) => Promise<void>;
  /** Clears Home to empty (removes the saved row). Never touches data. */
  resetPrefs: () => Promise<void>;
}

const AdminPrefsContext = createContext<AdminPrefsContextValue | null>(null);

export function AdminPrefsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  // Initial state is empty - Admin Home is empty by default.
  const [prefs, setPrefs] = useState<AdminDashboardPrefs>(EMPTY_ADMIN_PREFS);
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

    (supabase.from("admin_dashboard_prefs") as any)
      .select("layout")
      .eq("admin_id", profile.id)
      .maybeSingle()
      .then(({ data, error: fetchError }: { data: any; error: unknown }) => {
        if (cancelled) return;
        if (fetchError) {
          setError("Couldn't load your Home layout.");
        } else {
          // JSONB comes back as an already-parsed object. No row (or a
          // malformed row) normalizes to an EMPTY dashboard.
          setPrefs(normalizeAdminPrefs(data?.layout ?? null));
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
    async (next: AdminDashboardPrefs) => {
      const normalized = normalizeAdminPrefs(next);
      setPrefs(normalized);
      if (!profile) return;
      const { error: writeError } = await (createClient().from("admin_dashboard_prefs") as any).upsert(
        {
          school_id: profile.school_id,
          admin_id: profile.id,
          layout: { widgets: normalized.widgets },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "admin_id" }
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

  /** Clears Home back to empty (removes the row). Never touches data. */
  const resetPrefs = useCallback(async () => {
    setPrefs(EMPTY_ADMIN_PREFS);
    if (!profile) return;
    const { error: writeError } = await (createClient().from("admin_dashboard_prefs") as any)
      .delete()
      .eq("admin_id", profile.id);
    if (writeError) {
      setError("Couldn't clear your Home layout.");
      refetch();
    } else {
      setError(null);
    }
  }, [profile, refetch]);

  return (
    <AdminPrefsContext.Provider value={{ prefs, loading, error, savePrefs, resetPrefs }}>
      {children}
    </AdminPrefsContext.Provider>
  );
}

export function useAdminPrefs() {
  const ctx = useContext(AdminPrefsContext);
  if (!ctx) throw new Error("useAdminPrefs must be used within AdminPrefsProvider");
  return ctx;
}
