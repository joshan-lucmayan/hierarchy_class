# Habit Tracker - Guide

The Habit Tracker (`/student/habits`) is a **personal routine tracker**. It
helps students build consistency outside of official academic grading -
think of it as the "life admin" layer of the app. It is deliberately
**separate from grades and ranks**: completing a habit never changes your
Academic Excellence, rank bar, or leaderboard position. Only teacher
submitted and admin approved grades move ranks.

---

## Quick start

1. Open **Habits** in the student sidebar.
2. Every student starts with five defaults:
   - **Study** - 5 times/week (Mon-Fri)
   - **Exercise** - 4 times/week
   - **Reading** - 30 minutes/day
   - **Sleep** - 8 hours/day
   - **Focus** - 60 minutes/day
3. Each day, open the page and tick today's habits (or type the amount for
   duration/quantity goals). The **Today** list at the top is what needs
   attention right now.
4. Track your weekly progress in the summary cards and the Mon-Sun grid.
5. Click any habit for details, history, edit, pause, archive, or delete.

---

## Goals and targets

Each habit has a **goal type** and a **target**:

| Goal type | What you set | Example |
|---|---|---|
| Completion | Times per day/week | Exercise 4 times/week |
| Count | Sessions/reps per day/week | Study 2 sessions/day |
| Duration | Minutes per day | Read 30 min/day |
| Quantity | Units per day | 20 pages/day |

**Frequency matters:**

- **Weekly** targets (e.g. Exercise 4x/week) add up across the whole
  week. Doing it Monday, Tuesday, Thursday, and Saturday = 4/4, even if
  you skip Wednesday. You never have to hit it every day.
- **Daily** targets (e.g. Read 30 min/day) must be hit on each scheduled
  day. A daily habit scheduled Mon-Fri needs its target met every one of
  those five days.

**Scheduled days** decide which weekdays the habit applies to. A Mon-Fri
habit simply does not exist on Saturday and Sunday - skipping Saturday can
never break your streak or count as missed.

---

## Streaks

A streak counts **consecutive scheduled days you completed**:

- A missed **scheduled** day breaks the streak (e.g. skipping Friday breaks
  a Mon-Fri run).
- **Unscheduled** days are ignored entirely (skipping Saturday never
  breaks a Mon-Fri streak).
- **Paused** days are treated as not scheduled - pausing can never break a
  streak.
- Today counts once it is complete; a scheduled-but-still-pending today
  does not break the streak (the day hasn't passed yet).

The detail view shows your **current streak** and your all-time **best
streak**.

---

## Pause, archive, delete

- **Pause** - stop tracking temporarily. Paused habits disappear from
  Today, are never counted as missed, and never break streaks. History is
  kept. Resume anytime.
- **Archive** - soft delete. The habit hides from the tracker but keeps
  its history, and lands in the **Archived** section at the bottom of the
  page where you can **Restore** it (history and streaks come back) or
  **Delete** it forever.
- **Delete** - permanent. Removes the habit and **all** its records from
  the database (entries and pause windows cascade). There is a
  confirmation step - there is no undo.

---

## Editing

Edit changes the habit definition only (name, target, schedule, etc.).
**Historical records are never rewritten** - past entries stay exactly as
they were recorded, so history always stays accurate. Changing today's
target does not retroactively change past days.

---

## History

The history calendar at the bottom shows, per habit:

- **This week / 30 days / 90 days / All** ranges.
- Cell states: ✓ completed, ✕ a scheduled day that passed without a
  record, · not scheduled (or paused), ○ future, and today is outlined.

---

## Where your data lives

Everything is stored in Supabase (`habits`, `habit_entries`,
`habit_pauses`) and scoped to **your student account** via Row-Level
Security. Nobody else can read, modify, or delete your habits, and you
cannot touch anyone else's. Records are unique per (habit, day) at the
database level, so repeated taps never create duplicates.

The weekly stats, best habit, completion rate, and streaks on screen are
all computed from your real records by `lib/habitLogic.ts` (pure,
unit-tested math) - there is no mock or placeholder data anywhere.
