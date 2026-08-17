/**
 * rankEngine.test.ts - unit tests for the non-linear rank progression engine.
 *
 * COMPOSITE MODEL (migration 047): the bar moves by the power-curved weighted
 * average of the active category percentages (S), not by per-entry weight
 * shares - weights act at the composite level. Runs with the built-in Node
 * test runner: node --test lib/rankEngine.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RANK_ORDER,
  CATEGORIES,
  DEFAULT_RANK_CONFIG,
  createDefaultState,
  resolveConfig,
  computeCategoryPercent,
  computeComposite,
  computeAdjusted,
  computeFillChange,
  applyRankUpdate,
  applyEXScoreUpdate,
  validateScoreEntry,
  previewRankUpdate,
  confirmAndApplyScoreEntry,
  processScoreEntry,
  resetPeriodCategoryTotals,
  endSeason,
  getSeasonHistory,
  getDualRankDisplay,
  maxRank,
  type Rank,
  type RankPeriodEntry,
  type Category,
  type StudentRankState,
} from "./rankEngine.ts";

const cfg = resolveConfig();

function state(over: Partial<StudentRankState> = {}): StudentRankState {
  return createDefaultState("stu-1", over);
}

/** Build period entries: [category, earned, possible][] */
function entries(list: Array<[Category, number, number]>): RankPeriodEntry[] {
  return list.map(([category, points_earned, points_possible], i) => ({
    student_id: "stu-1",
    period_id: "P1",
    category,
    points_earned,
    points_possible,
    id: `e${i}`,
  }));
}

const approx = (actual: number, expected: number, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${actual} to be within ${tol} of ${expected}`);

// ---------------------------------------------------------------------------
// 1. Per-entry isolation: the entry's OWN pct and weight share
// ---------------------------------------------------------------------------

test("computeCategoryPercent is a category's earned/possible * 100 and may exceed 100", () => {
  approx(computeCategoryPercent([{ points_earned: 40, points_possible: 50 }])!, 80);
  approx(computeCategoryPercent([{ points_earned: 50, points_possible: 50 }])!, 100);
  approx(computeCategoryPercent([{ points_earned: 58, points_possible: 50 }])!, 116); // bonus credit
  approx(computeCategoryPercent([{ points_earned: 0, points_possible: 100 }])!, 0);
});

test("computeComposite weights the ACTIVE categories by the configured weights", () => {
  // Default weights { exam: 0.4, quiz: 0.2, activity: 0.25, participation: 0.15 } sum to 1.
  // All categories at 100 -> composite 100; a single active category -> its own pct.
  approx(computeComposite({ quiz: 100, exam: 100, activity: 100, participation: 100 }, cfg.weights)!, 100);
  approx(computeComposite({ quiz: null, exam: 100, activity: null, participation: null }, cfg.weights)!, 100);

  // The blend is fixed by the config weights over the categories that have
  // entries: quiz 100 + exam 0 -> (0.2*100 + 0.4*0) / (0.2+0.4) = 33.3333.
  approx(computeComposite({ quiz: 100, exam: 0, activity: null, participation: null }, cfg.weights)!, 33.3333);
  const allActive = { quiz: 40, exam: 40, activity: 20, participation: 0 };
  approx(computeComposite(allActive, cfg.weights)!, 0.2 * 40 + 0.4 * 40 + 0.25 * 20 + 0.15 * 0);
});

test("computeAdjusted applies the power curve to the entry's own pct", () => {
  approx(computeAdjusted(50, 1.8), 28.72);
  approx(computeAdjusted(70, 1.8), 52.62);
  approx(computeAdjusted(90, 1.8), 82.73);
  approx(computeAdjusted(100, 1.8), 100);
  approx(computeAdjusted(110, 1.8), 118.71);
});

// ---------------------------------------------------------------------------
// 2. Bonus scores within 1.5x push entry pct past 100 without rejection
// ---------------------------------------------------------------------------

test("bonus scores (earned > possible, within 1.5x) exceed 100 without being rejected", () => {
  const v = validateScoreEntry(58, 50, "quiz");
  assert.equal(v.valid, true);
  assert.equal(v.warnings.length, 0);

  // The entry's own pct is 116; the bar uses the CAPPED pct, the EX check the
  // UNCAPPED adjusted value.
  const st = state({ current_rank: "D", current_bar: 0 });
  const preview = previewRankUpdate({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 58, pointsPossible: 50 });
  approx(preview.S!, 116);
  approx(preview.adjusted_uncapped!, 100 * Math.pow(1.16, 1.8)); // ~130.6, uncapped
  approx(preview.adjusted_capped!, 100); // capped pct -> power curve 100
  assert.ok(preview.adjusted_uncapped! > 100);
});

test("earned between possible and 1.5x possible is valid with no warning", () => {
  const v = validateScoreEntry(120, 100, "quiz");
  assert.equal(v.valid, true);
  assert.equal(v.warnings.length, 0);
});

// ---------------------------------------------------------------------------
// 3. >1.5x is a warning, not a block
// ---------------------------------------------------------------------------

test("pointsEarned > pointsPossible * 1.5 is flagged as a warning but not blocked", () => {
  const v = validateScoreEntry(500, 50, "quiz");
  assert.equal(v.valid, true);
  assert.ok(v.warnings.some((w) => w.includes("1.5")));

  const v2 = validateScoreEntry(76, 50, "quiz"); // exactly 1.52x
  assert.equal(v2.valid, true);
  assert.ok(v2.warnings.length === 1);
});

test("validation hard-blocks negative earned and non-positive possible", () => {
  const a = validateScoreEntry(-1, 50, "quiz");
  assert.equal(a.valid, false);
  const b = validateScoreEntry(10, 0, "quiz");
  assert.equal(b.valid, false);
  const c = validateScoreEntry(10, -5, "quiz");
  assert.equal(c.valid, false);
});

test("validation flags pointsPossible that differs drastically from its peers", () => {
  const peers = [
    { points_earned: 45, points_possible: 100 },
    { points_earned: 48, points_possible: 100 },
    { points_earned: 50, points_possible: 100 },
  ];
  const v = validateScoreEntry(40, 100, "quiz", "P1", "stu-1", { peers });
  assert.equal(v.valid, true);
  assert.equal(v.warnings.length, 0);

  const bad = validateScoreEntry(40, 500, "quiz", "P1", "stu-1", { peers });
  assert.equal(bad.valid, true);
  assert.ok(bad.warnings.some((w) => w.includes("differs drastically")));
});

// ---------------------------------------------------------------------------
// 4. fillChange: composite-driven, zero at 50% quality
// ---------------------------------------------------------------------------

test("fillChange is zero at 50% adjusted and scales with n", () => {
  assert.equal(computeFillChange(50, 3), 0);
  assert.equal(computeFillChange(50, 12), 0);
  approx(computeFillChange(100, 3), 33.3333); // 1 * (100/3)
  approx(computeFillChange(100, 4), 25);
  approx(computeFillChange(100, 5), 20);
  approx(computeFillChange(100, 12), 8.3333);
  approx(computeFillChange(75, 4), 12.5);
  approx(computeFillChange(62.5, 5), 5);
});

test("fill uses the composite through the power curve", () => {
  // 116% quiz -> composite 116 -> adjusted_uncapped 130.62 -> capped 100 ->
  // fill = 1 * (100/3) = 33.333.
  const st = state({ current_rank: "D", current_bar: 0 });
  const preview = previewRankUpdate({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 58, pointsPossible: 50 });
  approx(preview.adjusted_uncapped!, 130.63);
  approx(preview.fillChange!, 33.3333);

  // 75% exam -> composite 75 -> adjusted 59.58 -> fill = (59.58-50)/50 * (100/4) = 4.791.
  const st2 = state({ current_rank: "C", current_bar: 0 });
  const p2 = previewRankUpdate({ state: st2, periodEntries: [], config: cfg, category: "exam", pointsEarned: 75, pointsPossible: 100 });
  approx(p2.fillChange!, 4.7907);
});

test("weights drive the composite: a perfect exam out-moves a perfect quiz by exactly its weight ratio", () => {
  // Same 100% entries in different categories: the composite (and therefore
  // the fill) scales by the configured weight ratio. exam 0.4 / quiz 0.2 = 2x.
  const st = state({ current_rank: "D", current_bar: 0 });
  const quizS = previewRankUpdate({
    state: st, config: cfg, category: "quiz", pointsEarned: 100, pointsPossible: 100,
    periodEntries: entries([["exam", 0, 100]]),
  }).S!;
  const examS = previewRankUpdate({
    state: st, config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100,
    periodEntries: entries([["quiz", 0, 100]]),
  }).S!;
  approx(quizS, 33.3333);
  approx(examS, 66.6667);
  approx(examS / quizS, 2, 0.001); // exactly 0.4/0.2
});

test("other entries change this entry's fill through the composite", () => {
  // The same 40/50 quiz blends with whatever else is in the period: the bar
  // moves by the composite (power-curved weighted average of category pcts).
  // A perfect exam raises the blend; a bad quiz in the same category drags it.
  const st = state({ current_rank: "D", current_bar: 0 });

  const alone = previewRankUpdate({
    state: st, config: cfg, category: "quiz", pointsEarned: 40, pointsPossible: 50, periodEntries: [],
  }).fillChange!;

  const afterPerfectExam = previewRankUpdate({
    state: st, config: cfg, category: "quiz", pointsEarned: 40, pointsPossible: 50,
    periodEntries: entries([["exam", 100, 100]]),
  }).fillChange!;

  const afterBadQuiz = previewRankUpdate({
    state: st, config: cfg, category: "quiz", pointsEarned: 40, pointsPossible: 50,
    periodEntries: entries([["quiz", 0, 100]]),
  }).fillChange!;

  approx(alone, 11.2806); // S = 80 -> adjusted 66.93 -> fill 11.28
  approx(afterPerfectExam, 25.5476); // S = 93.33 -> fill 25.55
  approx(afterBadQuiz, -27.1581); // quiz category 26.67% -> drains the bar
});

// ---------------------------------------------------------------------------
// 5. Promotion: fill-first, next tier bar exactly 0 (no overflow carried)
// ---------------------------------------------------------------------------

test("promotion requires new_bar >= 100 exactly and the next tier starts at exactly 0", () => {
  // B tier n=5: with a fill of 10, bar 90 -> 100.
  const p = applyRankUpdate("B", 90, 10, cfg);
  assert.deepEqual(p, { newRank: "A", newBar: 0, promoted: true, demoted: false, cascade_tiers: 0 });

  const justBelow = applyRankUpdate("B", 89.9999, 10, cfg);
  assert.equal(justBelow.promoted, false);
  approx(justBelow.newBar, 99.9999);

  // No overflow carried: bar 95 + fill 20 = 115 -> promote, bar exactly 0.
  const noCarry = applyRankUpdate("B", 95, 20, cfg);
  assert.deepEqual(noCarry, { newRank: "A", newBar: 0, promoted: true, demoted: false, cascade_tiers: 0 });
});

test("D rank can promote to C", () => {
  const p = applyRankUpdate("D", 90, 33.3334, cfg); // bar 123.33 >= 100
  assert.deepEqual(p, { newRank: "C", newBar: 0, promoted: true, demoted: false, cascade_tiers: 0 });
});

// ---------------------------------------------------------------------------
// 6. Demotion: 100-overflow landing; catastrophic caps at 2 tiers, never below D
// ---------------------------------------------------------------------------

test("demotion lands at 100 - overflow in the previous tier", () => {
  // A -> B, overflow 20 -> bar 80.
  const d = applyRankUpdate("A", 10, -30, cfg);
  assert.deepEqual(d, { newRank: "B", newBar: 80, promoted: false, demoted: true, cascade_tiers: 1 });
});

test("catastrophic entry caps the cascade at 2 tiers total, never more", () => {
  // A (bar 5, fill -200): new_bar -195, overflow 195, landing 100-195 < 0 -> two tiers: B -> C.
  const d = applyRankUpdate("A", 5, -200, cfg);
  assert.deepEqual(d, { newRank: "C", newBar: 0, promoted: false, demoted: true, cascade_tiers: 2 });

  // S+ (bar 1, fill -300): two tiers S+ -> S -> A.
  const d2 = applyRankUpdate("S+", 1, -300, cfg);
  assert.deepEqual(d2, { newRank: "A", newBar: 0, promoted: false, demoted: true, cascade_tiers: 2 });
});

test("demotion never goes below D", () => {
  // D is the floor.
  const floor = applyRankUpdate("D", 10, -100, cfg);
  assert.deepEqual(floor, { newRank: "D", newBar: 0, promoted: false, demoted: true, cascade_tiers: 0 });

  // C: previous tier is D; a catastrophic overflow clamps at D, one tier only.
  const c = applyRankUpdate("C", 5, -300, cfg);
  assert.deepEqual(c, { newRank: "D", newBar: 0, promoted: false, demoted: true, cascade_tiers: 1 });

  const c2 = applyRankUpdate("C", 1, -400, cfg);
  assert.equal(c2.newRank, "D");
  assert.equal(c2.newBar, 0);
});

// ---------------------------------------------------------------------------
// 7. S++ -> EX promotion (same fill-first rule)
// ---------------------------------------------------------------------------

test("applyRankUpdate promotes S++ to EX when its bar reaches 100", () => {
  const p = applyRankUpdate("S++", 90, 12, cfg);
  assert.deepEqual(p, { newRank: "EX", newBar: 0, promoted: true, demoted: false, cascade_tiers: 0 });

  const exact = applyRankUpdate("S++", 91.6667, 8.3333, cfg); // hits exactly 100
  assert.deepEqual(exact, { newRank: "EX", newBar: 0, promoted: true, demoted: false, cascade_tiers: 0 });

  const notYet = applyRankUpdate("S++", 90, 8.3333, cfg);
  assert.equal(notYet.promoted, false);
  approx(notYet.newBar, 98.3333);
});

// ---------------------------------------------------------------------------
// 8. EX score: flat steps on the entry's UNCAPPED adjusted, floor at 0
// ---------------------------------------------------------------------------

test("applyEXScoreUpdate adds exactly EX_STEP regardless of how far above 50", () => {
  assert.equal(applyEXScoreUpdate(0, 51, 1), 1);
  assert.equal(applyEXScoreUpdate(0, 100, 1), 1);
  assert.equal(applyEXScoreUpdate(0, 1000, 1), 1);
  assert.equal(applyEXScoreUpdate(5, 60, 1), 6);
});

test("applyEXScoreUpdate subtracts exactly EX_STEP below 50 and floors at 0", () => {
  assert.equal(applyEXScoreUpdate(5, 49, 1), 4);
  assert.equal(applyEXScoreUpdate(5, 0, 1), 4);
  assert.equal(applyEXScoreUpdate(0, 0, 1), 0);
  assert.equal(applyEXScoreUpdate(0, 10, 1), 0);
  assert.equal(applyEXScoreUpdate(5, 30, 2), 3); // custom exStep
  assert.equal(applyEXScoreUpdate(1, 30, 2), 0); // floors, never negative
});

test("ex_score has no upper cap - can climb past 1000", () => {
  let score = 0;
  for (let i = 0; i < 1000; i++) {
    score = applyEXScoreUpdate(score, 60, 1);
  }
  assert.equal(score, 1000);
});

// ---------------------------------------------------------------------------
// 9. Once EX, entries never change the rank - only ex_score moves
// ---------------------------------------------------------------------------

test("once ranked EX, further entries never change current_rank - only ex_score moves", () => {
  const st = state({ current_rank: "EX", current_bar: 0, ex_score: 5, peak_rank_this_season: "EX" });
  const preview = previewRankUpdate({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 30, pointsPossible: 50 });
  assert.equal(preview.rank_after, "EX");
  assert.equal(preview.bar_after, 0);
  assert.equal(preview.promoted, false);
  assert.equal(preview.demoted, false);
  // Entry pct 60 -> adjusted_uncapped 100*(0.6)^1.8 = 39.87 < 50 -> subtract.
  approx(preview.ex_score_after!, 4);
});

test("EX ex_score moves with the entry's own uncapped adjusted, even through terrible stretches", () => {
  const st = state({ current_rank: "EX", current_bar: 0, ex_score: 5, peak_rank_this_season: "EX" });
  const bad = previewRankUpdate({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 0, pointsPossible: 100 });
  assert.equal(bad.rank_after, "EX"); // never demotes out of EX
  approx(bad.ex_score_after!, 4);

  const good = previewRankUpdate({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 100, pointsPossible: 100 });
  assert.equal(good.rank_after, "EX");
  approx(good.ex_score_after!, 6);

  const confirmed = confirmAndApplyScoreEntry({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 100, pointsPossible: 100 });
  assert.equal(confirmed.state.current_rank, "EX");
  assert.equal(confirmed.state.ex_score, 6);
});

// ---------------------------------------------------------------------------
// 10. ex_score resets to 0 each time EX is (re)reached
// ---------------------------------------------------------------------------

test("ex_score resets to 0 when S++ promotes into EX, and again after a season reset climb", () => {
  // First climb: S++ bar 98 with a leftover ex_score from a previous era.
  // A perfect EXAM (weight 0.4) at S++ (n=12) adds 1*(100/12)*0.4 = 3.333, so
  // 98 + 3.333 >= 100 -> promote.
  const st = state({ current_rank: "S++", current_bar: 98, ex_score: 999, peak_rank_this_season: "S++" });
  const confirmed = confirmAndApplyScoreEntry({ state: st, periodEntries: [], config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100 });
  assert.equal(confirmed.state.current_rank, "EX");
  assert.equal(confirmed.state.ex_score, 0); // fresh EX run

  // Season ends while EX: resets to C.
  const seasonEnd = endSeason(confirmed.state, {
    season_id: "S1",
    school_year: "2026-2027",
    semester_label: "First Semester",
    grade_level: "Grade 12",
    season_end_date: "2027-03-31",
  }, cfg);
  assert.equal(seasonEnd.state.current_rank, "C");
  assert.equal(seasonEnd.state.current_bar, 0);

  // Climb back C -> B -> A -> S -> S+ -> S++ and promote again: ex_score is 0 again.
  // Perfect exams (weight 0.4): C(n=4)+10, B(n=5)+8, A(n=6)+6.67, S(n=8)+5,
  // S+(n=10)+4, S++(n=12)+3.33 -> ~113 entries total; loop bound is generous.
  let climb = seasonEnd.state;
  let reachedEx = false;
  for (let i = 0; i < 300 && !reachedEx; i++) {
    const r = confirmAndApplyScoreEntry({ state: climb, periodEntries: [], config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100 });
    climb = r.state;
    if (climb.current_rank === "EX") reachedEx = true;
  }
  assert.equal(reachedEx, true, "climb should have reached EX again");
  assert.equal(climb.current_rank, "EX");
  assert.equal(climb.ex_score, 0); // fresh EX run on re-reach
});

// ---------------------------------------------------------------------------
// 11. previewRankUpdate has zero side effects
// ---------------------------------------------------------------------------

test("previewRankUpdate never mutates state or entries - repeated calls are identical", () => {
  const st = state({ current_rank: "B", current_bar: 40, peak_rank_this_season: "B" });
  const ents = entries([["quiz", 40, 50], ["exam", 80, 100]]);
  const before = JSON.stringify({ state: st, entries: ents });

  const r1 = previewRankUpdate({ state: st, periodEntries: ents, config: cfg, category: "quiz", pointsEarned: 10, pointsPossible: 50 });
  const r2 = previewRankUpdate({ state: st, periodEntries: ents, config: cfg, category: "quiz", pointsEarned: 10, pointsPossible: 50 });
  const r3 = previewRankUpdate({ state: st, periodEntries: ents, config: cfg, category: "quiz", pointsEarned: 10, pointsPossible: 50 });

  assert.equal(JSON.stringify({ state: st, entries: ents }), before);
  assert.deepEqual(r1, r2);
  assert.deepEqual(r2, r3);
});

// ---------------------------------------------------------------------------
// 12. confirmAndApplyScoreEntry rejects invalid inputs
// ---------------------------------------------------------------------------

test("confirmAndApplyScoreEntry rejects hard-invalid inputs", () => {
  const st = state({ current_rank: "D", current_bar: 0 });
  assert.throws(() =>
    confirmAndApplyScoreEntry({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: -5, pointsPossible: 50 }),
  );
  assert.throws(() =>
    confirmAndApplyScoreEntry({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 10, pointsPossible: 0 }),
  );
});

test("processScoreEntry rejects invalid input without applying anything", () => {
  const st = state({ current_rank: "D", current_bar: 0 });
  const res = processScoreEntry({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: -1, pointsPossible: 50, autoConfirm: true });
  assert.equal(res.valid, false);
  assert.equal(res.confirmed, undefined);
  assert.equal(st.current_bar, 0);
});

test("processScoreEntry with autoConfirm applies and surfaces the event distinctly", () => {
  // D bar 90 + perfect exam fill 1*(100/3)*0.4 = 13.33 -> 103.33 -> promote to C.
  const st = state({ current_rank: "D", current_bar: 90 });
  const res = processScoreEntry({ state: st, periodEntries: [], config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100, autoConfirm: true });
  assert.equal(res.valid, true);
  assert.ok(res.confirmed);
  assert.equal(res.confirmed!.event.type, "promotion");
  assert.equal(res.confirmed!.state.current_rank, "C");
  assert.equal(res.confirmed!.state.current_bar, 0);
});

// ---------------------------------------------------------------------------
// 13. endSeason applies SEASON_RESET_MAP for every rank
// ---------------------------------------------------------------------------

test("endSeason applies SEASON_RESET_MAP for every rank and resets the bar to 0", () => {
  const expected: Record<Rank, Rank> = {
    EX: "C", "S++": "C", "S+": "C", S: "C",
    A: "D", B: "D", C: "D", D: "D",
  };
  for (const rank of RANK_ORDER) {
    const st = state({ current_rank: rank, current_bar: 50, peak_rank_this_season: rank, highest_rank_ever: "D" });
    const { state: next, log } = endSeason(st, {
      season_id: "S1",
      school_year: "2026-2027",
      semester_label: "First Semester",
      grade_level: "Grade 12",
      season_end_date: "2027-03-31",
    }, cfg);
    assert.equal(next.current_rank, expected[rank], `reset for ${rank}`);
    assert.equal(next.current_bar, 0);
    assert.equal(next.peak_rank_this_season, expected[rank]);
    assert.equal(log.reset_to_rank, expected[rank]);
    assert.equal(log.peak_rank, rank);
    assert.equal(log.final_rank_before_reset, rank);
    assert.equal(log.ex_achieved, rank === "EX");
  }
});

test("highest_rank_ever only increases, never decreases", () => {
  const st = state({ current_rank: "A", current_bar: 20, peak_rank_this_season: "A", highest_rank_ever: "S++" });
  const { state: next } = endSeason(st, {
    season_id: "S1",
    school_year: "2026-2027",
    semester_label: "First Semester",
    grade_level: "Grade 12",
    season_end_date: "2027-03-31",
  }, cfg);
  assert.equal(next.highest_rank_ever, "S++"); // A < S++: untouched
  assert.equal(next.highest_rank_season, null);

  const st2 = state({ current_rank: "A", current_bar: 20, peak_rank_this_season: "EX", highest_rank_ever: "S+" });
  const r2 = endSeason(st2, {
    season_id: "S2",
    school_year: "2026-2027",
    semester_label: "Second Semester",
    grade_level: "Grade 12",
    season_end_date: "2027-06-30",
  }, cfg);
  assert.equal(r2.state.highest_rank_ever, "EX"); // record from the PEAK
  assert.equal(r2.state.highest_rank_season, "S2");
  assert.equal(r2.log.reset_to_rank, "D"); // final A -> D (peak EX only sets the record)
});

// ---------------------------------------------------------------------------
// 14. peak_rank_this_season is a high-water mark; endSeason uses the peak
// ---------------------------------------------------------------------------

test("peak_rank_this_season only increases on promotion and survives later demotions", () => {
  // D bar 95 + perfect EXAM fill 1*(100/3)*0.4 = 13.33 -> 108.33 -> C, peak C.
  let st = state({ current_rank: "D", current_bar: 95, peak_rank_this_season: "D" });
  const r1 = confirmAndApplyScoreEntry({ state: st, periodEntries: [], config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100 });
  st = r1.state;
  assert.equal(st.current_rank, "C");
  assert.equal(st.peak_rank_this_season, "C");

  // Push to B: C bar 90 + perfect EXAM fill 1*(100/4)*0.4 = 10 -> 100 -> B, peak B.
  st = { ...st, current_bar: 90 };
  const r2 = confirmAndApplyScoreEntry({ state: st, periodEntries: [], config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100 });
  st = r2.state;
  assert.equal(st.current_rank, "B");
  assert.equal(st.peak_rank_this_season, "B");

  // Demotion: B (n=5) with a 0-quality QUIZ: composite 0 -> adjusted 0 ->
  // fill = (0-50)/50 * (100/5) = -20 -> bar -20 -> overflow 20 -> C at bar 80.
  // Peak stays B.
  st = { ...st, current_bar: 0 };
  const r3 = confirmAndApplyScoreEntry({ state: st, periodEntries: [], config: cfg, category: "quiz", pointsEarned: 0, pointsPossible: 100 });
  st = r3.state;
  assert.equal(st.current_rank, "C");
  assert.equal(st.current_bar, 80);
  assert.equal(st.peak_rank_this_season, "B");
});

test("endSeason reseeds from the FINAL rank; the peak is recorded and updates the all-time record", () => {
  // Reached S mid-season, demoted to A right before season close.
  const st = state({
    current_rank: "A",
    current_bar: 12,
    peak_rank_this_season: "S",
    highest_rank_ever: "A",
    season_id: "S1",
  });
  const { state: next, log } = endSeason(st, {
    season_id: "S1",
    school_year: "2026-2027",
    semester_label: "First Semester",
    grade_level: "Grade 12",
    season_end_date: "2027-03-31",
  }, cfg);

  assert.equal(log.peak_rank, "S"); // the peak is kept in history
  assert.equal(log.final_rank_before_reset, "A");
  assert.equal(log.reset_to_rank, "D"); // map[A], not map[S]
  assert.equal(log.ex_achieved, false);
  assert.equal(next.highest_rank_ever, "S"); // record updated from the peak
  assert.equal(next.highest_rank_season, "S1");
  assert.equal(next.current_rank, "D"); // reseeded from the FINAL rank
  assert.equal(next.current_bar, 0);
  assert.equal(next.peak_rank_this_season, "D");
});

// ---------------------------------------------------------------------------
// 15. resetPeriodCategoryTotals clears category data only
// ---------------------------------------------------------------------------

test("resetPeriodCategoryTotals clears category data but leaves rank state untouched", () => {
  const st = state({
    current_rank: "A",
    current_bar: 55,
    ex_score: 0,
    peak_rank_this_season: "S",
    highest_rank_ever: "S",
    highest_rank_season: "S0",
    period_id: "P1",
  });
  const before = { ...st };
  const { state: next, entries: cleared } = resetPeriodCategoryTotals(st, "P2");

  assert.deepEqual(next.current_rank, before.current_rank);
  assert.deepEqual(next.current_bar, before.current_bar);
  assert.deepEqual(next.ex_score, before.ex_score);
  assert.deepEqual(next.peak_rank_this_season, before.peak_rank_this_season);
  assert.deepEqual(next.highest_rank_ever, before.highest_rank_ever);
  assert.deepEqual(next.highest_rank_season, before.highest_rank_season);
  assert.equal(cleared.length, 0);
  assert.equal(next.period_id, "P2");
});

// ---------------------------------------------------------------------------
// 16. All config is externally configurable, never hardcoded
// ---------------------------------------------------------------------------

test("k is configurable (k=1 makes Adjusted == pct)", () => {
  const flat = resolveConfig({ k: 1 });
  assert.equal(computeAdjusted(80, flat.k), 80);
});

test("exStep is configurable", () => {
  const big = resolveConfig({ exStep: 5 });
  assert.equal(applyEXScoreUpdate(0, 60, big.exStep), 5);
  assert.equal(applyEXScoreUpdate(3, 30, big.exStep), 0);
});

test("tier n values are configurable and affect fillChange", () => {
  const custom = resolveConfig({
    tiers: [
      { rank: "D", next: "C", n: 10 },
      { rank: "C", next: "B", n: 4 },
      { rank: "B", next: "A", n: 5 },
      { rank: "A", next: "S", n: 6 },
      { rank: "S", next: "S+", n: 8 },
      { rank: "S+", next: "S++", n: 10 },
      { rank: "S++", next: "EX", n: 12 },
    ],
  });
  // D's n is now 10: fill = 1 * (100/10) = 10.
  approx(computeFillChange(100, custom.tiers.find((t) => t.rank === "D")!.n), 10);
});

test("weights are configurable and drive the composite", () => {
  const custom = resolveConfig({ weights: { exam: 1, quiz: 0, activity: 0, participation: 0 } });
  approx(computeComposite({ quiz: 100, exam: 100, activity: null, participation: null }, custom.weights)!, 100);
  approx(computeComposite({ quiz: 100, exam: 0, activity: null, participation: null }, custom.weights)!, 0);

  // Only-exam weight: a perfect exam fills the full bar amount; a category
  // with zero weight is not counted - a period with only a zero-weight
  // category has no composite and the pipeline stops (S and fillChange null).
  const st = state({ current_rank: "D", current_bar: 0 });
  const examFill = previewRankUpdate({
    state: st, config: custom, category: "exam", pointsEarned: 100, pointsPossible: 100, periodEntries: [],
  }).fillChange!;
  const quizPreview = previewRankUpdate({
    state: st, config: custom, category: "quiz", pointsEarned: 100, pointsPossible: 100, periodEntries: [],
  });
  approx(examFill, 33.3333);
  assert.equal(quizPreview.S, null);
  assert.equal(quizPreview.fillChange, null);

  assert.throws(() => resolveConfig({ weights: { exam: 0.5, quiz: 0.5, activity: 0.5, participation: 0.5 } })); // sums to 2
  assert.throws(() => resolveConfig({ weights: { exam: 1.1, quiz: -0.1, activity: 0, participation: 0 } })); // negative + wrong sum
});

test("season reset map is configurable", () => {
  const custom = resolveConfig({
    seasonResetMap: { EX: "C", "S++": "C", "S+": "C", S: "C", A: "C", B: "C", C: "C", D: "C" },
  });
  const st = state({ current_rank: "B", current_bar: 30, peak_rank_this_season: "B", highest_rank_ever: "D" });
  const { state: next } = endSeason(st, {
    season_id: "S1",
    school_year: "2026-2027",
    semester_label: "First Semester",
    grade_level: "Grade 12",
    season_end_date: "2027-03-31",
  }, custom);
  assert.equal(next.current_rank, "C");
});

test("resolveConfig validates the built-in config", () => {
  const c = resolveConfig();
  assert.equal(c.k, 1.8);
  assert.equal(c.exStep, 1);
  assert.deepEqual(c.seasonResetMap, DEFAULT_RANK_CONFIG.seasonResetMap);
  assert.equal(c.tiers.find((t) => t.rank === "S++")!.next, "EX");
});

// ---------------------------------------------------------------------------
// Query helpers + full pipeline integration
// ---------------------------------------------------------------------------

test("getDualRankDisplay exposes the display fields", () => {
  const st = state({ current_rank: "S+", current_bar: 44, ex_score: 0, peak_rank_this_season: "S++", highest_rank_ever: "S++", highest_rank_season: "S1" });
  const d = getDualRankDisplay(st);
  assert.deepEqual(d, {
    current_rank: "S+",
    current_bar: 44,
    highest_rank_ever: "S++",
    highest_rank_season: "S1",
    ex_score: 0,
    peak_rank_this_season: "S++",
  });
});

test("getSeasonHistory orders by season_end_date", () => {
  const mk = (season_id: string, date: string) => ({
    student_id: "stu-1",
    season_id,
    school_year: "2026-2027",
    semester_label: "X",
    grade_level: "Grade 12",
    strand_or_track: null,
    section: null,
    peak_rank: "A" as Rank,
    final_rank_before_reset: "A" as Rank,
    reset_to_rank: "D" as Rank,
    ex_achieved: false,
    season_end_date: date,
  });
  const sorted = getSeasonHistory([mk("S2", "2027-06-30"), mk("S1", "2027-03-31")]);
  assert.equal(sorted[0].season_id, "S1");
  assert.equal(sorted[1].season_id, "S2");
});

test("full pipeline: per-entry accumulation, promotion is fill-first end to end", () => {
  // D, bar 95. One perfect EXAM (n=3) pushes the bar over 100 (fill 33.33)
  // -> promote to C at 0.
  let st = state({ current_rank: "D", current_bar: 95, peak_rank_this_season: "D" });
  let ents: RankPeriodEntry[] = [];

  const preview = previewRankUpdate({ state: st, periodEntries: ents, config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100 });
  assert.equal(preview.promoted, true);
  assert.equal(preview.rank_after, "C");
  assert.equal(preview.bar_after, 0);

  const r = confirmAndApplyScoreEntry({ state: st, periodEntries: ents, config: cfg, category: "exam", pointsEarned: 100, pointsPossible: 100 });
  st = r.state;
  ents = r.entries;
  assert.equal(st.current_rank, "C");
  assert.equal(st.current_bar, 0);
  assert.equal(st.peak_rank_this_season, "C");
  assert.equal(ents.length, 1);

  // Period reset: totals cleared, rank untouched.
  const reset = resetPeriodCategoryTotals(st, "P2");
  st = reset.state;
  ents = reset.entries;
  assert.equal(st.current_rank, "C");
  assert.equal(ents.length, 0);
});

test("maxRank returns the higher rank", () => {
  assert.equal(maxRank("D", "EX"), "EX");
  assert.equal(maxRank("S+", "S++"), "S++");
  assert.equal(maxRank("A", "A"), "A");
  assert.equal(maxRank("S++", "EX"), "EX");
});

test("a single catastrophic entry demotes at most two tiers total", () => {
  // Direct check of the cap across every tier: never more than 2 tier steps.
  for (const rank of RANK_ORDER.filter((r) => r !== "EX" && r !== "D")) {
    const res = applyRankUpdate(rank, 0, -10000, cfg);
    assert.ok(res.cascade_tiers <= 2, `${rank}: cascade ${res.cascade_tiers} > 2`);
    assert.ok(res.newRank !== "EX");
    const moved = RANK_ORDER.indexOf(rank) - RANK_ORDER.indexOf(res.newRank);
    assert.ok(moved >= 0 && moved <= 2, `${rank}: moved ${moved}`);
  }
});
