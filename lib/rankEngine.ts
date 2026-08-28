/**
 * rankEngine.ts - Non-linear student rank progression engine (pure logic).
 *
 *
 * Model summary (see spec):
 *  - Categories (quiz/exam/activity/participation) accumulate points per
 *    grading PERIOD. CategoryPct resets at each new period.
 *  - Composite S = weighted average of active category percentages.
 *  - Adjusted = 100*(S/100)^k (power curve, k default 1.8).
 *  - The rank bar moves by fillChange = ((Adjusted_capped-50)/50)*(100/n);
 *    promotion is fill-first (bar hits 100 -> next tier at bar 0), demotion is
 *    overflow-based and capped at 2 tiers per entry, never below D.
 *  - EX is reached by filling the S++ -> EX bar; afterwards the student tracks
 *    an open-ended ex_score (flat +1/-1 per period, floors at 0) and never
 *    demotes out of EX through the normal mechanic.
 *  - Seasons reseed ranks at the end via SEASON_RESET_MAP, using the season's
 *    PEAK rank (a high-water mark) - not the rank at the literal moment the
 *    season ends. highest_rank_ever never resets.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const RANK_ORDER = ["D", "C", "B", "A", "S", "S+", "S++", "EX"] as const;
export type Rank = (typeof RANK_ORDER)[number];

/** Human-readable display names — codes remain D/C/B/A/S/S+/S++/EX. */
export const RANK_DISPLAY_NAMES: Record<Rank, string> = {
  D: "D",
  C: "C",
  B: "B",
  A: "A",
  S: "S",
  "S+": "Honors",
  "S++": "Distinguished",
  EX: "Exceptional",
} as const;

export function getRankDisplayName(rank: Rank): string {
  return RANK_DISPLAY_NAMES[rank] ?? rank;
}

export const CATEGORIES = ["quiz", "exam", "activity", "participation"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface TierEntry {
  /** Current rank this tier governs. */
  rank: Rank;
  /** Rank awarded when this tier's bar reaches 100 (fill-first). */
  next: Rank;
  /** Tier divisor in the fillChange formula (how "long" the bar is). */
  n: number;
}

export interface RankConfig {
  /** Category weights; must sum to 1 (100%). */
  weights: Record<Category, number>;
  /** Power-curve exponent for Adjusted = 100*(S/100)^k. */
  k: number;
  /** Flat EX step added/subtracted per period while ranked EX. */
  exStep: number;
  /** One entry per rank D..S++ (S++ -> EX included). */
  tiers: TierEntry[];
  /** Season-end reseed map, keyed by the season's FINAL rank. */
  seasonResetMap: Record<Rank, Rank>;
}

export interface StudentRankState {
  student_id: string;
  school_id?: string;
  /** In-play rank for the current season. */
  current_rank: Rank;
  /** 0-100 bar; meaningless once current_rank === "EX" (see ex_score). */
  current_bar: number;
  /** Open-ended, uncapped; only meaningful when current_rank === "EX". */
  ex_score: number;
  /** High-water mark for the current season; only ever moves up. */
  peak_rank_this_season: Rank;
  /** All-time peak across all seasons - monotonic, never resets. */
  highest_rank_ever: Rank;
  /** season_id that produced highest_rank_ever. */
  highest_rank_season: string | null;
  season_id: string | null;
  period_id: string | null;
}

export interface RankPeriodEntry {
  id?: string;
  student_id: string;
  period_id: string;
  category: Category;
  points_earned: number;
  points_possible: number;
  created_at?: string;
}

export interface SeasonHistoryLog {
  student_id: string;
  season_id: string;
  school_year: string;
  semester_label: string;
  grade_level: string;
  strand_or_track: string | null;
  section: string | null;
  /** Highest rank reached at ANY point during the season. */
  peak_rank: Rank;
  /** Actual rank at the literal season end (audit/transparency only). */
  final_rank_before_reset: Rank;
  /** SEASON_RESET_MAP[final_rank] - where the next season starts. The PEAK
   *  rank is still recorded separately (peak_rank) and drives the all-time
   *  highest_rank_ever record, but it does not decide the reset. */
  reset_to_rank: Rank;
  ex_achieved: boolean;
  season_end_date: string;
}

export interface RankEvent {
  type: "update" | "promotion" | "demotion" | "ex_score" | "period_reset" | "season_reset";
  promoted: boolean;
  demoted: boolean;
  cascade_tiers: number;
  rank_before: Rank;
  rank_after: Rank;
  bar_before: number;
  bar_after: number;
  ex_score_before: number;
  ex_score_after: number;
  s_score: number | null;
  adjusted: number | null;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export interface PreviewResult {
  /** Composite S (0-100+, can exceed 100 with bonus credit). Null when no active categories. */
  S: number | null;
  /** Adjusted (power curve) - may exceed 100 (bonus case). */
  adjusted: number | null;
  /** min(adjusted, 100) - drives the normal rank bar. */
  adjusted_capped: number | null;
  /** Raw power-curve value - used only for EX eligibility. */
  adjusted_uncapped: number | null;
  fillChange: number | null;
  bar_before: number;
  bar_after: number;
  rank_before: Rank;
  rank_after: Rank;
  promoted: boolean;
  demoted: boolean;
  cascade_tiers: number;
  warnings: string[];
  /** Result of Section 6 when rank_before === "EX"; null otherwise. */
  ex_score_after: number | null;
}

export interface ConfirmResult {
  state: StudentRankState;
  /** The entries list with the newly confirmed entry appended. */
  entries: RankPeriodEntry[];
  event: RankEvent;
  preview: PreviewResult;
}

export interface PreviewInput {
  state: StudentRankState;
  periodEntries: RankPeriodEntry[];
  config: RankConfig;
  category: Category;
  pointsEarned: number;
  pointsPossible: number;
}

// ---------------------------------------------------------------------------
// Defaults / config
// ---------------------------------------------------------------------------

export const DEFAULT_RANK_CONFIG: RankConfig = {
  weights: { exam: 0.4, quiz: 0.2, activity: 0.25, participation: 0.15 },
  k: 1.8,
  exStep: 1,
  tiers: [
    { rank: "D", next: "C", n: 3 },
    { rank: "C", next: "B", n: 4 },
    { rank: "B", next: "A", n: 5 },
    { rank: "A", next: "S", n: 6 },
    { rank: "S", next: "S+", n: 8 },
    { rank: "S+", next: "S++", n: 10 },
    { rank: "S++", next: "EX", n: 12 },
  ],
  seasonResetMap: {
    EX: "C",
    "S++": "C",
    "S+": "C",
    S: "C",
    A: "D",
    B: "D",
    C: "D",
    D: "D",
  },
};

export function rankIndex(rank: Rank): number {
  const i = RANK_ORDER.indexOf(rank);
  return i === -1 ? -1 : i;
}

/** Highest of two ranks by RANK_ORDER position. */
export function maxRank(a: Rank, b: Rank): Rank {
  return rankIndex(a) >= rankIndex(b) ? a : b;
}

/**
 * Merge a partial config over the defaults. Throws on invalid weights (they
 * must sum to 1 / 100%) - a configurable system must never run with a broken
 * weighting, and every other knob is validated here too.
 */
export function resolveConfig(partial?: Partial<RankConfig>): RankConfig {
  const cfg: RankConfig = {
    weights: { ...DEFAULT_RANK_CONFIG.weights, ...(partial?.weights ?? {}) },
    k: partial?.k ?? DEFAULT_RANK_CONFIG.k,
    exStep: partial?.exStep ?? DEFAULT_RANK_CONFIG.exStep,
    tiers: partial?.tiers ?? DEFAULT_RANK_CONFIG.tiers,
    seasonResetMap: { ...DEFAULT_RANK_CONFIG.seasonResetMap, ...(partial?.seasonResetMap ?? {}) },
  };

  const total = CATEGORIES.reduce((sum, c) => sum + (cfg.weights[c] ?? 0), 0);
  if (Math.abs(total - 1) > 1e-6) {
    throw new Error(`rankEngine: weights must sum to 1 (got ${total.toFixed(4)})`);
  }
  for (const c of CATEGORIES) {
    if (!(c in cfg.weights) || cfg.weights[c] < 0) {
      throw new Error(`rankEngine: invalid weight for category "${c}"`);
    }
  }
  if (!(cfg.k > 0) || !Number.isFinite(cfg.k)) throw new Error("rankEngine: k must be a positive finite number");
  if (!Number.isInteger(cfg.exStep) || cfg.exStep < 0) throw new Error("rankEngine: exStep must be a non-negative integer");
  if (!Array.isArray(cfg.tiers) || cfg.tiers.length === 0) throw new Error("rankEngine: tiers must be a non-empty array");
  for (const rank of RANK_ORDER.filter((r) => r !== "EX")) {
    const tier = cfg.tiers.find((t) => t.rank === rank);
    if (!tier || !(tier.n > 0)) throw new Error(`rankEngine: missing/invalid tier for rank "${rank}"`);
    if (!cfg.seasonResetMap[rank] && rank !== "D") {
      throw new Error(`rankEngine: missing season reset for rank "${rank}"`);
    }
  }
  for (const rank of RANK_ORDER) {
    if (!cfg.seasonResetMap[rank]) throw new Error(`rankEngine: missing season reset for rank "${rank}"`);
  }
  return cfg;
}

export function createDefaultState(studentId: string, opts?: Partial<Omit<StudentRankState, "student_id">>): StudentRankState {
  return {
    student_id: studentId,
    current_rank: "D",
    current_bar: 0,
    ex_score: 0,
    peak_rank_this_season: "D",
    highest_rank_ever: "D",
    highest_rank_season: null,
    season_id: null,
    period_id: null,
    ...opts,
  };
}

// ---------------------------------------------------------------------------
// Section 2 - category percentages (per grading period, running total)
// ---------------------------------------------------------------------------

/**
 * Accumulates a score entry into a running (earned, possible) total - the pure
 * equivalent of the spec's updateCategoryTotals (the DB version upserts into
 * rank_period_entries; this one folds into an in-memory totals map).
 */
export function updateCategoryTotals(
  totals: Record<Category, { earned: number; possible: number }>,
  category: Category,
  pointsEarned: number,
  pointsPossible: number,
): Record<Category, { earned: number; possible: number }> {
  const cur = totals[category] ?? { earned: 0, possible: 0 };
  return {
    ...totals,
    [category]: { earned: cur.earned + pointsEarned, possible: cur.possible + pointsPossible },
  };
}

/**
 * CategoryPct(c) = (Σ points_earned_this_period[c]) / (Σ points_possible_this_period[c]) × 100
 * null (not 0) when the category has zero entries - excluded from the composite.
 * Bonus credit allowed: earned may exceed possible, so the result may exceed 100.
 */
export function computeCategoryPercent(
  entries: Array<Pick<RankPeriodEntry, "points_earned" | "points_possible">>,
): number | null {
  if (entries.length === 0) return null;
  let earned = 0;
  let possible = 0;
  for (const e of entries) {
    earned += e.points_earned;
    possible += e.points_possible;
  }
  if (possible <= 0) return null;
  return (earned / possible) * 100;
}

// ---------------------------------------------------------------------------
// Section 3 - composite score (S)
// ---------------------------------------------------------------------------

/**
 * S = ( Σ weights[c] × active[c] ) / active_weight_total.
 * active[c] is CategoryPct already in percent units (0-100+), so the weighted
 * mean is the composite score on the same scale - no extra ×100 (the spec's
 * ×100 applies when percentages are stored as fractions; ours are already ×100).
 * Returns null when NO category has entries this period - the pipeline must
 * stop and not touch the bar.
 */
export function computeComposite(
  pcts: Record<Category, number | null>,
  weights: Record<Category, number>,
): number | null {
  let weighted = 0;
  let weightTotal = 0;
  for (const c of CATEGORIES) {
    const pct = pcts[c];
    if (pct === null || pct === undefined) continue;
    const w = weights[c] ?? 0;
    weighted += w * pct;
    weightTotal += w;
  }
  if (weightTotal <= 0) return null;
  return weighted / weightTotal;
}

// ---------------------------------------------------------------------------
// Section 4 - adjusted score (power curve)
// ---------------------------------------------------------------------------

/** Adjusted = 100 × (S/100)^k. May exceed 100 when S exceeds 100 (bonus). */
export function computeAdjusted(S: number, k: number): number {
  return 100 * Math.pow(S / 100, k);
}

// ---------------------------------------------------------------------------
// Section 5 - bar change, promotion, demotion (D through S++ only)
// ---------------------------------------------------------------------------

/**
 * fillChange = ((Adjusted_capped − 50) / 50) × (100 / n). The bar moves by the
 * cumulative composite quality (the power-curved weighted average of category
 * percentages), so a grade that keeps the average high moves the bar, and one
 * below ~50 composite drains it. Grades below 50% quality drain the bar.
 */
export function computeFillChange(adjustedCapped: number, n: number): number {
  return ((adjustedCapped - 50) / 50) * (100 / n);
}

export interface RankUpdateResult {
  newRank: Rank;
  newBar: number;
  promoted: boolean;
  demoted: boolean;
  /** Tier steps moved down on a demotion: 0, 1, or 2 (capped). */
  cascade_tiers: number;
}

function tierFor(rank: Rank, cfg: RankConfig): TierEntry | undefined {
  return cfg.tiers.find((t) => t.rank === rank);
}

function prevRankFor(rank: Rank, cfg: RankConfig): Rank | null {
  const t = cfg.tiers.find((t) => t.next === rank);
  return t ? t.rank : null;
}

/**
 * Applies the bar mechanic. Promotion is fill-first: bar must reach >= 100, the
 * next tier always starts at exactly 0 (no overflow carried) - including the
 * S++ -> EX promotion. Demotion is overflow-based, capped at 2 tiers per single
 * entry, never below D. EX is a short-circuit: it never demotes via this path.
 */
export function applyRankUpdate(
  currentRank: Rank,
  currentBar: number,
  fillChange: number,
  cfg: RankConfig,
): RankUpdateResult {
  if (currentRank === "EX") {
    return { newRank: "EX", newBar: 0, promoted: false, demoted: false, cascade_tiers: 0 };
  }

  const newBar = currentBar + fillChange;

  // Promotion - fill-first rule.
  if (newBar >= 100) {
    const tier = tierFor(currentRank, cfg);
    const next = tier ? tier.next : currentRank;
    return { newRank: next, newBar: 0, promoted: true, demoted: false, cascade_tiers: 0 };
  }

  // Demotion - overflow determines the landing spot in the previous tier.
  if (newBar < 0) {
    const overflow = -newBar;
    if (currentRank === "D") {
      // Floor - cannot go below D.
      return { newRank: "D", newBar: 0, promoted: false, demoted: true, cascade_tiers: 0 };
    }
    const prev = prevRankFor(currentRank, cfg) ?? "D";
    const landingBar = 100 - overflow;
    if (landingBar < 0) {
      // Catastrophic single entry: cap the cascade at ONE additional tier
      // beyond the first (2 tiers total), clamp bar at 0 in that second tier.
      const prev2 = prevRankFor(prev, cfg);
      if (prev2 === null) {
        // Previous tier is D and even D overflows: land at D with bar 0.
        return { newRank: prev, newBar: 0, promoted: false, demoted: true, cascade_tiers: 1 };
      }
      return { newRank: prev2, newBar: 0, promoted: false, demoted: true, cascade_tiers: 2 };
    }
    return { newRank: prev, newBar: landingBar, promoted: false, demoted: true, cascade_tiers: 1 };
  }

  // Normal case - no rank change.
  return { newRank: currentRank, newBar, promoted: false, demoted: false, cascade_tiers: 0 };
}

// ---------------------------------------------------------------------------
// Section 6 - EX score mechanic (open-ended, uncapped)
// ---------------------------------------------------------------------------

/**
 * Flat step, not proportional: >= 50 adds exactly exStep (regardless of how far
 * above 50); < 50 subtracts exactly exStep, flooring at 0 (does not go
 * negative). No upper cap - the score can climb past 1000.
 */
export function applyEXScoreUpdate(currentExScore: number, adjustedUncapped: number, exStep: number): number {
  if (adjustedUncapped >= 50) {
    return currentExScore + exStep;
  }
  return Math.max(0, currentExScore - exStep);
}

// ---------------------------------------------------------------------------
// Section 11 - validation / preview / confirm safety flow
// ---------------------------------------------------------------------------

export interface ValidationContext {
  /**
   * Other entries in the same category + period, used only for the "pointsPossible
   * differs drastically from its peers" typo warning.
   */
  peers?: Array<Pick<RankPeriodEntry, "points_earned" | "points_possible">>;
}

/**
 * validateScoreEntry - hard blocks vs. warnings:
 *  - pointsEarned < 0            -> invalid (hard block)
 *  - pointsPossible <= 0         -> invalid (hard block)
 *  - earned > possible × 1.5     -> valid + WARNING (likely a typo like 500 vs 50)
 *  - possible < earned <= 1.5×   -> valid, no warning (legitimate bonus credit)
 *  - pointsPossible far off its peers in the same category+period -> warning
 */
export function validateScoreEntry(
  pointsEarned: number,
  pointsPossible: number,
  _category?: Category,
  _periodId?: string,
  _studentId?: string,
  ctx?: ValidationContext,
): ValidationResult {
  const warnings: string[] = [];

  if (!Number.isFinite(pointsEarned) || pointsEarned < 0) {
    return { valid: false, warnings: ["pointsEarned must be a non-negative number"] };
  }
  if (!Number.isFinite(pointsPossible) || pointsPossible <= 0) {
    return { valid: false, warnings: ["pointsPossible must be greater than 0"] };
  }

  if (pointsEarned > pointsPossible * 1.5) {
    warnings.push(
      `pointsEarned (${pointsEarned}) is more than 1.5× pointsPossible (${pointsPossible}) - likely a data-entry mistake`,
    );
  }

  const peers = ctx?.peers ?? [];
  if (peers.length > 0) {
    const possibleValues = peers.map((p) => p.points_possible);
    const median = [...possibleValues].sort((a, b) => a - b)[Math.floor(possibleValues.length / 2)];
    if (median > 0 && (pointsPossible > median * 1.5 || pointsPossible * 1.5 < median)) {
      warnings.push(
        `pointsPossible (${pointsPossible}) differs drastically from other entries in this category/period (median ${median}) - possible typo in the max score`,
      );
    }
  }

  return { valid: true, warnings };
}

/** Group period entries by category and compute each category's running pct. */
export function categoryPercentsFromEntries(
  entries: Array<Pick<RankPeriodEntry, "category" | "points_earned" | "points_possible">>,
): Record<Category, number | null> {
  const pcts: Record<Category, number | null> = { quiz: null, exam: null, activity: null, participation: null };
  const totals: Record<Category, { earned: number; possible: number }> = {
    quiz: { earned: 0, possible: 0 },
    exam: { earned: 0, possible: 0 },
    activity: { earned: 0, possible: 0 },
    participation: { earned: 0, possible: 0 },
  };
  for (const e of entries) {
    if (!(e.category in totals)) continue;
    totals[e.category].earned += e.points_earned;
    totals[e.category].possible += e.points_possible;
  }
  for (const c of CATEGORIES) {
    if (totals[c].possible > 0) pcts[c] = (totals[c].earned / totals[c].possible) * 100;
  }
  return pcts;
}

/**
 * previewRankUpdate - runs the FULL pipeline (Sections 2-5) and returns the
 * result WITHOUT persisting anything. Pure: calling it repeatedly has zero side
 * effects. Throws only on hard-invalid input (callers should validate first).
 */
export function previewRankUpdate(input: PreviewInput): PreviewResult {
  const { state, periodEntries, config, category, pointsEarned, pointsPossible } = input;

  const validation = validateScoreEntry(pointsEarned, pointsPossible, category, state.period_id ?? undefined, state.student_id, {
    peers: periodEntries.filter((e) => e.category === category),
  });
  if (!validation.valid) {
    throw new Error(`rankEngine: invalid score entry - ${validation.warnings.join("; ")}`);
  }

  const warnings = [...validation.warnings];
  const entriesWithNew = [
    ...periodEntries,
    { student_id: state.student_id, period_id: state.period_id ?? "", category, points_earned: pointsEarned, points_possible: pointsPossible },
  ];
  const pcts = categoryPercentsFromEntries(entriesWithNew);
  const S = computeComposite(pcts, config.weights);
  const barBefore = state.current_bar;

  if (S === null) {
    return {
      S: null,
      adjusted: null,
      adjusted_capped: null,
      adjusted_uncapped: null,
      fillChange: null,
      bar_before: barBefore,
      bar_after: barBefore,
      rank_before: state.current_rank,
      rank_after: state.current_rank,
      promoted: false,
      demoted: false,
      cascade_tiers: 0,
      warnings,
      ex_score_after: null,
    };
  }

  const adjusted = computeAdjusted(S, config.k);
  const adjustedCapped = Math.min(adjusted, 100);
  const adjustedUncapped = adjusted;

  // EX: no bar mechanic - the open-ended score (Section 6) is what moves.
  if (state.current_rank === "EX") {
    return {
      S,
      adjusted,
      adjusted_capped: adjustedCapped,
      adjusted_uncapped: adjustedUncapped,
      fillChange: null,
      bar_before: barBefore,
      bar_after: barBefore,
      rank_before: "EX",
      rank_after: "EX",
      promoted: false,
      demoted: false,
      cascade_tiers: 0,
      warnings,
      ex_score_after: applyEXScoreUpdate(state.ex_score, adjustedUncapped, config.exStep),
    };
  }

  const tier = config.tiers.find((t) => t.rank === state.current_rank);
  const n = tier ? tier.n : 1;
  // The bar moves by the composite quality through the power curve
  // (adjusted_capped) - the ORIGINAL rank math, restored by migration 047.
  const fillChange = computeFillChange(adjustedCapped, n);
  const update = applyRankUpdate(state.current_rank, barBefore, fillChange, config);

  return {
    S,
    adjusted,
    adjusted_capped: adjustedCapped,
    adjusted_uncapped: adjustedUncapped,
    fillChange,
    bar_before: barBefore,
    bar_after: update.newBar,
    rank_before: state.current_rank,
    rank_after: update.newRank,
    promoted: update.promoted,
    demoted: update.demoted,
    cascade_tiers: update.cascade_tiers,
    warnings,
    ex_score_after: null,
  };
}

/**
 * confirmAndApplyScoreEntry - the ONLY operation permitted to change rank state.
 * Pure: returns the next state + event without writing anything; the DB layer
 * (RPC confirm_and_apply_score_entry) persists it. Re-validates before applying
 * and rejects invalid inputs.
 */
export function confirmAndApplyScoreEntry(input: PreviewInput): ConfirmResult {
  const { state, periodEntries, config, category, pointsEarned, pointsPossible } = input;

  const validation = validateScoreEntry(pointsEarned, pointsPossible, category, state.period_id ?? undefined, state.student_id, {
    peers: periodEntries.filter((e) => e.category === category),
  });
  if (!validation.valid) {
    throw new Error(`rankEngine: refusing to apply invalid score entry - ${validation.warnings.join("; ")}`);
  }

  const preview = previewRankUpdate(input);
  const entry: RankPeriodEntry = {
    student_id: state.student_id,
    period_id: state.period_id ?? "",
    category,
    points_earned: pointsEarned,
    points_possible: pointsPossible,
  };
  const entries = [...periodEntries, entry];

  const next: StudentRankState = { ...state };
  const exBefore = state.ex_score;
  let exAfter = exBefore;

  if (state.current_rank === "EX") {
    // Section 6 - the open-ended score moves, rank never changes.
    exAfter = applyEXScoreUpdate(state.ex_score, preview.adjusted_uncapped ?? 0, config.exStep);
    next.ex_score = exAfter;
  } else {
    next.current_rank = preview.rank_after;
    next.current_bar = preview.bar_after;
    if (preview.promoted) {
      // Peak tracking: a high-water mark that only ever moves up, updated on
      // every promotion event and never lowered by a later demotion.
      next.peak_rank_this_season = maxRank(state.peak_rank_this_season, preview.rank_after);
      if (preview.rank_after === "EX") {
        // First reaching EX (or re-reaching after a season reset): fresh run.
        exAfter = 0;
        next.ex_score = 0;
      }
    }
  }

  const event: RankEvent = {
    type: preview.promoted ? "promotion" : preview.demoted ? "demotion" : state.current_rank === "EX" ? "ex_score" : "update",
    promoted: preview.promoted,
    demoted: preview.demoted,
    cascade_tiers: preview.cascade_tiers,
    rank_before: state.current_rank,
    rank_after: next.current_rank,
    bar_before: state.current_bar,
    bar_after: next.current_bar,
    ex_score_before: exBefore,
    ex_score_after: exAfter,
    s_score: preview.S,
    adjusted: preview.adjusted,
  };

  return { state: next, entries, event, preview };
}

// ---------------------------------------------------------------------------
// Section 11 - processScoreEntry orchestration (pure)
// ---------------------------------------------------------------------------

export interface ProcessResult {
  valid: boolean;
  warnings: string[];
  preview?: PreviewResult;
  /** Present only when autoConfirm was true (or when a human confirmed). */
  confirmed?: ConfirmResult;
}

/**
 * Orchestrates validate -> preview -> (auto-confirm). When the surrounding app
 * has no human-confirmation step, pass autoConfirm: true - promotion/demotion
 * events are still surfaced distinctly (event.type) for later review.
 */
export function processScoreEntry(input: PreviewInput & { autoConfirm?: boolean }): ProcessResult {
  const { state, periodEntries, config, category, pointsEarned, pointsPossible, autoConfirm } = input;
  const validation = validateScoreEntry(pointsEarned, pointsPossible, category, state.period_id ?? undefined, state.student_id, {
    peers: periodEntries.filter((e) => e.category === category),
  });
  if (!validation.valid) {
    return { valid: false, warnings: validation.warnings };
  }
  const preview = previewRankUpdate({ state, periodEntries, config, category, pointsEarned, pointsPossible });
  if (!autoConfirm) {
    return { valid: true, warnings: preview.warnings, preview };
  }
  const confirmed = confirmAndApplyScoreEntry({ state, periodEntries, config, category, pointsEarned, pointsPossible });
  return { valid: true, warnings: preview.warnings, preview, confirmed };
}

// ---------------------------------------------------------------------------
// Section 11 - resetPeriodCategoryTotals (period boundary, not season)
// ---------------------------------------------------------------------------

/**
 * Called at the start of a new grading PERIOD: clears the running category
 * totals only and leaves StudentRankState (rank/bar/highest) completely
 * untouched. The DB layer deletes the old period's rank_period_entries rows;
 * here we return the fresh empty entries list and the updated period id.
 */
export function resetPeriodCategoryTotals(state: StudentRankState, newPeriodId: string): { state: StudentRankState; entries: RankPeriodEntry[] } {
  return { state: { ...state, period_id: newPeriodId }, entries: [] };
}

// ---------------------------------------------------------------------------
// Section 8 - season reset (peak-based reseeding)
// ---------------------------------------------------------------------------

export interface EndSeasonMeta {
  season_id: string;
  school_year: string;
  semester_label: string;
  grade_level: string;
  strand_or_track?: string | null;
  section?: string | null;
  season_end_date: string;
}

/**
 * endSeason - reseeds the next season from the season's FINAL rank (so a
 * late-season demotion lands you where you actually ended - e.g. S mid-season
 * but A at the end resets to D). The PEAK rank is recorded in the history log
 * and drives the all-time highest_rank_ever record (monotonic), but it does
 * not decide the reset. Writes the SeasonHistoryLog, updates
 * highest_rank_ever/highest_rank_season, then reseeds
 * current_rank/current_bar/peak_rank_this_season.
 */
export function endSeason(state: StudentRankState, meta: EndSeasonMeta, cfg: RankConfig): { state: StudentRankState; log: SeasonHistoryLog } {
  const peak = state.peak_rank_this_season;
  const resetTo = cfg.seasonResetMap[state.current_rank];

  const next: StudentRankState = { ...state };
  if (rankIndex(peak) > rankIndex(state.highest_rank_ever)) {
    next.highest_rank_ever = peak;
    next.highest_rank_season = meta.season_id;
  }
  next.current_rank = resetTo;
  next.current_bar = 0;
  next.peak_rank_this_season = resetTo;
  next.season_id = meta.season_id;

  const log: SeasonHistoryLog = {
    student_id: state.student_id,
    season_id: meta.season_id,
    school_year: meta.school_year,
    semester_label: meta.semester_label,
    grade_level: meta.grade_level,
    strand_or_track: meta.strand_or_track ?? null,
    section: meta.section ?? null,
    peak_rank: peak,
    final_rank_before_reset: state.current_rank,
    reset_to_rank: resetTo,
    ex_achieved: peak === "EX",
    season_end_date: meta.season_end_date,
  };

  return { state: next, log };
}

// ---------------------------------------------------------------------------
// Sections 9-10 - query helpers
// ---------------------------------------------------------------------------

/** get_season_history - season logs ordered by season_end_date (ascending). */
export function getSeasonHistory(logs: SeasonHistoryLog[]): SeasonHistoryLog[] {
  return [...logs].sort((a, b) => (a.season_end_date < b.season_end_date ? -1 : a.season_end_date > b.season_end_date ? 1 : 0));
}

/** get_dual_rank_display - the fields a caller needs to render rank UI. */
export function getDualRankDisplay(state: StudentRankState): {
  current_rank: Rank;
  current_bar: number;
  highest_rank_ever: Rank;
  highest_rank_season: string | null;
  ex_score: number;
  peak_rank_this_season: Rank;
} {
  return {
    current_rank: state.current_rank,
    current_bar: state.current_bar,
    highest_rank_ever: state.highest_rank_ever,
    highest_rank_season: state.highest_rank_season,
    ex_score: state.ex_score,
    peak_rank_this_season: state.peak_rank_this_season,
  };
}
