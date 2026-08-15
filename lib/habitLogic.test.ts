import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  isScheduled,
  weekProgress,
  currentStreak,
  bestStreak,
  completionRate,
  weeklyStats,
  type HabitShape,
  type EntryShape,
  type PauseShape,
} from "./habitLogic.ts";

function habit(over: Partial<HabitShape> = {}): HabitShape {
  return {
    id: "h1",
    goalType: "completion",
    targetValue: 5,
    frequencyType: "weekly",
    scheduledDays: [0, 1, 2, 3, 4], // Mon-Fri
    status: "active",
    ...over,
  };
}

function entry(habitId: string, entryDate: string, value = 1): EntryShape {
  return { habitId, entryDate, value };
}

test("weekday index is Monday-first", () => {
  // 2026-08-10 was a Monday
  assert.equal(isScheduled(habit(), "2026-08-10"), true); // Mon
  assert.equal(isScheduled(habit(), "2026-08-14"), true); // Fri
  assert.equal(isScheduled(habit(), "2026-08-15"), false); // Sat
  assert.equal(isScheduled(habit(), "2026-08-16"), false); // Sun
});

test("weekly target: 4 logged days of a 4x/week target is 100%, no daily requirement", () => {
  const h = habit({ id: "ex", goalType: "count", targetValue: 4, frequencyType: "weekly", scheduledDays: [0, 1, 2, 3, 4, 5, 6] });
  const week = "2026-08-10"; // Monday
  const entries = [
    entry("ex", "2026-08-10"), // Mon
    entry("ex", "2026-08-11"), // Tue
    entry("ex", "2026-08-13"), // Thu
    entry("ex", "2026-08-15"), // Sat
  ];
  const p = weekProgress(h, entries, week, addDays(week, 6));
  assert.equal(p.completed, 4);
  assert.equal(p.target, 4);
  assert.equal(p.pct, 1);
});

test("weekly target: over-achievement caps at 100%", () => {
  const h = habit({ id: "ex", goalType: "completion", targetValue: 4, frequencyType: "weekly", scheduledDays: [0, 1, 2, 3, 4, 5, 6] });
  const week = "2026-08-10";
  const entries = [0, 1, 2, 3, 4, 5].map((i) => entry("ex", addDays(week, i)));
  const p = weekProgress(h, entries, week, addDays(week, 6));
  assert.equal(p.completed, 4);
  assert.equal(p.pct, 1);
});

test("daily target: reading 30 min/day, 4 complete days of 7 = 4/7", () => {
  const h = habit({
    id: "rd",
    goalType: "duration",
    targetValue: 30,
    frequencyType: "daily",
    scheduledDays: [0, 1, 2, 3, 4, 5, 6],
  });
  const week = "2026-08-10";
  const entries = [
    entry("rd", "2026-08-10", 45), // complete
    entry("rd", "2026-08-11", 10), // below target - not complete
    entry("rd", "2026-08-12", 30), // exactly target - complete
    entry("rd", "2026-08-13", 40), // complete
    entry("rd", "2026-08-14", 0), // logged 0 - not complete
    entry("rd", "2026-08-15", 60), // complete
  ];
  const p = weekProgress(h, entries, week, addDays(week, 6));
  assert.equal(p.completed, 4);
  assert.equal(p.target, 7);
  assert.equal(p.pct, 4 / 7);
});

test("daily target on a Mon-Fri schedule counts only scheduled days", () => {
  const h = habit({
    id: "fo",
    goalType: "duration",
    targetValue: 60,
    frequencyType: "daily",
    scheduledDays: [0, 1, 2, 3, 4],
  });
  const week = "2026-08-10";
  const entries = [entry("fo", "2026-08-10", 60), entry("fo", "2026-08-11", 60)];
  const p = weekProgress(h, entries, week, addDays(week, 6));
  assert.equal(p.completed, 2);
  assert.equal(p.target, 5);
});

test("streak: consecutive scheduled days, weekend gap does not break", () => {
  const h = habit({ id: "st", targetValue: 5, frequencyType: "weekly", scheduledDays: [0, 1, 2, 3, 4] });
  // Complete Mon-Fri of one week and Mon-Wed of the next.
  const week1 = "2026-08-10";
  const week2 = "2026-08-17";
  const entries = [
    ...[0, 1, 2, 3, 4].map((i) => entry("st", addDays(week1, i))),
    ...[0, 1, 2].map((i) => entry("st", addDays(week2, i))),
  ];
  // Wed 8/19 - 8 consecutive scheduled days; the weekend was never scheduled.
  assert.equal(currentStreak(h, [], entries, "2026-08-19"), 8);
  // Thu 8/20 scheduled but still pending - the run stays alive.
  assert.equal(currentStreak(h, [], entries, "2026-08-20"), 8);
  // Fri 8/21 - Thursday was a passed scheduled day without an entry: broken.
  assert.equal(currentStreak(h, [], entries, "2026-08-21"), 0);
});

test("streak: missed scheduled day breaks the streak", () => {
  const h = habit({ id: "st", scheduledDays: [0, 1, 2, 3, 4] });
  const week1 = "2026-08-10";
  const entries = [
    entry("st", "2026-08-10"), // Mon
    entry("st", "2026-08-11"), // Tue
    // Wed 8/12 missed
    entry("st", "2026-08-13"), // Thu
    entry("st", "2026-08-14"), // Fri
  ];
  // Today Fri 8/14 - the Wed miss breaks the run back to Thu-Fri = 2
  assert.equal(currentStreak(h, [], entries, "2026-08-14"), 2);
  assert.equal(bestStreak(h, [], entries, "2026-08-14"), 2);
});

test("streak: pending today does not break the streak", () => {
  const h = habit({ id: "st", scheduledDays: [0, 1, 2, 3, 4] });
  const week1 = "2026-08-10";
  const entries = [0, 1, 2, 3].map((i) => entry("st", addDays(week1, i))); // Mon-Thu
  // Today Fri 8/14 scheduled but not yet logged - the streak stays at 4.
  assert.equal(currentStreak(h, [], entries, "2026-08-14"), 4);
  // Saturday: Friday passed without an entry - a missed scheduled day, broken.
  assert.equal(currentStreak(h, [], entries, "2026-08-15"), 0);
});

test("streak: paused window does not break the streak", () => {
  const h = habit({ id: "st", scheduledDays: [0, 1, 2, 3, 4] });
  const week1 = "2026-08-10";
  const week3 = "2026-08-24";
  const entries = [
    ...[0, 1, 2, 3, 4].map((i) => entry("st", addDays(week1, i))), // week 1 complete
    ...[0, 1].map((i) => entry("st", addDays(week3, i))), // week 3 Mon-Tue complete
  ];
  const pauses: PauseShape[] = [{ habitId: "st", startedAt: "2026-08-17", endedAt: "2026-08-21" }];
  // Without the pause the week-2 weekdays would be missed and break the run.
  assert.equal(currentStreak(h, pauses, entries, "2026-08-25"), 7);
  assert.equal(currentStreak(h, [], entries, "2026-08-25"), 2);
});

test("streak: paused habit with open pause freezes the pre-pause run", () => {
  const h = habit({ id: "st", scheduledDays: [0, 1, 2, 3, 4] });
  const week1 = "2026-08-10";
  const entries = [0, 1, 2].map((i) => entry("st", addDays(week1, i))); // Mon-Wed
  const pauses: PauseShape[] = [{ habitId: "st", startedAt: "2026-08-13", endedAt: null }];
  assert.equal(currentStreak(h, pauses, entries, "2026-08-20"), 3);
});

test("streak: best streak spans missed days correctly", () => {
  const h = habit({ id: "st", scheduledDays: [0, 1, 2, 3, 4, 5, 6] });
  const start = "2026-08-03";
  const entries = [
    ...[0, 1, 2].map((i) => entry("st", addDays(start, i))), // Mon-Wed
    // Thu missed
    ...[4, 5].map((i) => entry("st", addDays(start, i))), // Fri-Sat
  ];
  assert.equal(bestStreak(h, [], entries, "2026-08-09"), 3);
});

test("completion rate: passed scheduled days only, pending today excluded", () => {
  const h = habit({ id: "rd", goalType: "duration", targetValue: 30, frequencyType: "daily", scheduledDays: [0, 1, 2, 3, 4, 5, 6] });
  const week = "2026-08-10";
  const entries = [
    entry("rd", "2026-08-10", 40), // complete
    entry("rd", "2026-08-11", 10), // below target - missed
    entry("rd", "2026-08-12", 35), // complete
  ];
  // Wed 8/12 done, Thu 8/13 pending - rate = 2/3 (today excluded)
  assert.equal(completionRate(h, [], entries, "2026-08-13"), 2 / 3);
  // Thu 8/13 completed -> rate = 3/4
  const entries2 = [...entries, entry("rd", "2026-08-13", 40)];
  assert.equal(completionRate(h, [], entries2, "2026-08-13"), 3 / 4);
});

test("weekly stats: completion pct, completed, remaining, best habit", () => {
  const study = habit({ id: "study", targetValue: 5, scheduledDays: [0, 1, 2, 3, 4] });
  const read = habit({ id: "read", goalType: "duration", targetValue: 30, frequencyType: "daily", scheduledDays: [0, 1, 2, 3, 4, 5, 6] });
  const week = "2026-08-10";
  const entries = [
    ...[0, 1, 2].map((i) => entry("study", addDays(week, i))), // 3/5
    entry("read", "2026-08-10", 40), // 1/7
  ];
  const s = weeklyStats([study, read], [], entries, week, addDays(week, 6), "2026-08-14");
  assert.equal(s.target, 12); // 5 + 7
  assert.equal(s.completed, 4); // 3 + 1
  assert.equal(s.remaining, 8);
  assert.equal(s.pct, 4 / 12);
  assert.equal(s.best?.habit.id, "study"); // 60% beats 14%
  assert.equal(s.rows.length, 2);
});

test("weekly stats: paused habits are excluded from the aggregate", () => {
  const study = habit({ id: "study", targetValue: 5, scheduledDays: [0, 1, 2, 3, 4] });
  const paused = habit({ id: "paused", status: "paused" });
  const week = "2026-08-10";
  const entries = [0, 1, 2].map((i) => entry("study", addDays(week, i))); // 3/5
  const s = weeklyStats([study, paused], [], entries, week, addDays(week, 6), "2026-08-14");
  assert.equal(s.target, 5); // the paused habit adds nothing
  assert.equal(s.completed, 3);
  assert.equal(s.rows.length, 1);
});
