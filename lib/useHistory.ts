"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import { RANK_ORDER, type Rank } from "@/lib/rankEngine";

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw row from rank_history_log. */
interface RankHistoryRow {
  id: string;
  school_id: string;
  student_id: string;
  period_id: string | null;
  category: string | null;
  points_earned: number | null;
  points_possible: number | null;
  s_score: number | null;
  adjusted: number | null;
  rank_before: string | null;
  rank_after: string | null;
  bar_before: number | null;
  bar_after: number | null;
  ex_score_before: number | null;
  ex_score_after: number | null;
  event_type: string;
  cascade_tiers: number;
  created_at: string;
}

/** Enrichment data from grade_entries + courses. */
interface GradeEnrichment {
  courseName: string | null;
  courseCode: string | null;
  gradeType: string | null;
  gradeLabel: string | null;
  score: number | null;
  maxScore: number | null;
  entryDate: string | null;
  teacherName: string | null;
}

/** A fully enriched history event ready for rendering. */
export interface HistoryEvent {
  id: string;
  eventType: string;
  category: string | null;
  pointsEarned: number | null;
  pointsPossible: number | null;
  sScore: number | null;
  adjusted: number | null;
  rankBefore: Rank | null;
  rankAfter: Rank | null;
  barBefore: number | null;
  barAfter: number | null;
  exScoreBefore: number | null;
  exScoreAfter: number | null;
  cascadeTiers: number;
  createdAt: string;
  grade: GradeEnrichment | null;
}

const VALID_RANKS: readonly string[] = ["D", "C", "B", "A", "S", "S+", "S++", "EX"];

function toRank(value: string | null): Rank | null {
  if (!value) return null;
  return VALID_RANKS.includes(value) ? (value as Rank) : null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHistory(studentId?: string | null) {
  const { profile } = useMyProfile();
  const targetId = studentId ?? profile?.id;

  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);
  const offsetRef = useRef(0);
  /** Bumped on every (re)load - invalidates in-flight fetches from an older
   *  generation (e.g. after the viewed student changed). */
  const generationRef = useRef(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Reset when targetId changes.
  useEffect(() => {
    offsetRef.current = 0;
    setEvents([]);
    setHasMore(true);
    setError(null);
  }, [targetId]);

  // Enrichment query must never be built with an empty `in()` - that is a
  // guaranteed bad request. (gradeTypes empty = no candidates anyway.)

  // Primary fetch: rank_history_log + batch enrichment.
  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!supabaseConfigured || !targetId) {
        setLoading(false);
        return;
      }

      // Snapshot the generation: when targetId changes, the reset effect
      // bumps the ref so any in-flight fetch knows its results are stale -
      // including the loading flags, which it must still release.
      const generation = ++generationRef.current;

      if (append) loadingMore.current = true;
      else setLoading(true);

      const supabase = createClient();

      // 1) Fetch rank_history_log page.
      const { data: rows, error: fetchErr } = await supabase
        .from("rank_history_log")
        .select("*")
        .eq("student_id", targetId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (generation !== generationRef.current) return;

      if (fetchErr) {
        setError("Couldn't load your history.");
        setLoading(false);
        loadingMore.current = false;
        return;
      }

      const historyRows = (rows ?? []) as RankHistoryRow[];
      setHasMore(historyRows.length === PAGE_SIZE);

      if (historyRows.length === 0) {
        if (!append) setEvents([]);
        setLoading(false);
        loadingMore.current = false;
        return;
      }

      // 2) Batch-fetch grade_entries enrichment.
      //    Collect all category + points_earned + points_possible + created_at
      //    fingerprints to match rank events to their source grades.
      //    Since rank_history_log doesn't have source_grade_id, we match by
      //    (student_id, category, points_earned, points_possible, created_at
      //     within a 5-second window).
      const gradeMap = await fetchGradeEnrichment(supabase, targetId, historyRows);

      if (generation !== generationRef.current) return;

      // 3) Merge into HistoryEvent objects.
      const enriched: HistoryEvent[] = historyRows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        category: row.category,
        pointsEarned: row.points_earned,
        pointsPossible: row.points_possible,
        sScore: row.s_score,
        adjusted: row.adjusted,
        rankBefore: toRank(row.rank_before),
        rankAfter: toRank(row.rank_after),
        barBefore: row.bar_before,
        barAfter: row.bar_after,
        exScoreBefore: row.ex_score_before,
        exScoreAfter: row.ex_score_after,
        cascadeTiers: row.cascade_tiers,
        createdAt: row.created_at,
        grade: gradeMap.get(row.id) ?? null,
      }));

      if (append) {
        setEvents((prev) => [...prev, ...enriched]);
      } else {
        setEvents(enriched);
      }

      offsetRef.current = offset + historyRows.length;
      setLoading(false);
      loadingMore.current = false;
    },
    [supabaseConfigured, targetId],
  );

  // Load. Re-running fetchPage bumps generationRef, which invalidates any
  // in-flight fetch from the previous generation (previous targetId).
  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore.current || !hasMore) return;
    fetchPage(offsetRef.current, true);
  }, [fetchPage, hasMore]);

  return { events, loading, error, hasMore, loadMore };
}

// ---------------------------------------------------------------------------
// Batch grade enrichment
// ---------------------------------------------------------------------------

/**
 * For each rank_history_log event that has a category + points_earned +
 * points_possible, try to find the matching grade_entries row. Match by
 * student_id + category mapping + score + max_score within a time window.
 *
 * Returns a Map<rank_history_log.id, GradeEnrichment>.
 */
async function fetchGradeEnrichment(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
  rows: RankHistoryRow[],
): Promise<Map<string, GradeEnrichment>> {
  const result = new Map<string, GradeEnrichment>();

  // Only events with category + points have potential grade matches.
  const candidateEvents = rows.filter(
    (r) => r.category && r.points_earned != null && r.points_possible != null,
  );

  if (candidateEvents.length === 0) return result;

  // Map rank category to grade_entries.type values.
  const categoryToGradeType: Record<string, string[]> = {
    quiz: ["Quiz"],
    exam: ["Exam"],
    activity: ["Activity", "Assignment"],
    participation: ["Participation"],
  };

  // Collect the time window for the query.
  const timestamps = rows.map((r) => new Date(r.created_at).getTime());
  const minTime = new Date(Math.min(...timestamps) - 10000).toISOString();
  const maxTime = new Date(Math.max(...timestamps) + 10000).toISOString();

  // Collect all possible grade types from the candidate events.
  const gradeTypes = new Set<string>();
  candidateEvents.forEach((r) => {
    categoryToGradeType[r.category!]?.forEach((t) => gradeTypes.add(t));
  });

  // Fetch grade_entries in the time window for this student. An empty `in()`
  // list is a guaranteed bad request - bail out instead.
  if (gradeTypes.size === 0) return result;
  const { data: gradeRows } = await supabase
    .from("grade_entries")
    .select(
      "id, type, score, max_score, label, entry_date, course_id, courses(name, code), submitted:profiles!submitted_by(full_name)",
    )
    .eq("student_id", studentId)
    .in("type", Array.from(gradeTypes))
    .gte("created_at", minTime)
    .lte("created_at", maxTime);

  if (!gradeRows || gradeRows.length === 0) return result;

  // Match each candidate event to its closest grade entry.
  for (const event of candidateEvents) {
    const eventTime = new Date(event.created_at).getTime();
    const allowedTypes = categoryToGradeType[event.category!] ?? [];
    const eventMaxScore = event.points_possible!;

    // Find the closest matching grade entry by type + max_score + time proximity.
    let bestMatch: any = null;
    let bestDistance = Infinity;

    for (const grade of gradeRows as any[]) {
      if (!allowedTypes.includes(grade.type)) continue;
      // Match max_score (grade.max_score defaults to 100 if null).
      const gradeMaxScore = grade.max_score ?? 100;
      if (gradeMaxScore !== eventMaxScore) continue;
      // Match score (grade.score maps to points_earned).
      if (grade.score !== event.points_earned) continue;

      const gradeTime = new Date(grade.created_at).getTime();
      const distance = Math.abs(eventTime - gradeTime);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = grade;
      }
    }

    if (bestMatch) {
      const course = bestMatch.courses;
      const teacher = bestMatch.submitted;
      result.set(event.id, {
        courseName: course?.name ?? null,
        courseCode: course?.code ?? null,
        gradeType: bestMatch.type ?? null,
        gradeLabel: bestMatch.label ?? null,
        score: bestMatch.score ?? null,
        maxScore: bestMatch.max_score ?? null,
        entryDate: bestMatch.entry_date ?? null,
        teacherName: teacher?.full_name ?? null,
      });
    }
  }

  return result;
}
