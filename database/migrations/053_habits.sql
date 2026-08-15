-- ===========================================================================
-- 053: Habits (student-defined habit definitions)
-- ---------------------------------------------------------------------------
-- The tracker previously used a fixed set of five habit types keyed directly
-- on habit_entries.habit_type. This migration adds a real `habits` table (one
-- row per student habit: name, description, goal type + target, daily/weekly
-- frequency, scheduled days, pause/archive status) and re-keys habit_entries
-- onto habits.id - so students get custom habits, per-goal targets, and
-- pause/archive - while preserving every existing entry.
--
-- Goal semantics (used by the app's habitLogic, kept here as documentation):
--   goal_type 'completion' | 'count'   -> one entry per day, value = units done
--   goal_type 'duration'   | 'quantity'-> one entry per day, value = amount
--   frequency 'weekly' -> weekly progress = sum(entry values) / target_value
--   frequency 'daily'  -> a scheduled day counts complete when value >= target
-- scheduled_days uses 0 = Monday .. 6 = Sunday (the app week is Monday-first,
-- matching lib/weekUtils.ts).
--
-- Idempotent: this repo has no migration-tracking table, so every statement
-- guards with IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  icon TEXT NOT NULL DEFAULT 'custom',
  goal_type TEXT NOT NULL DEFAULT 'completion'
    CHECK (goal_type IN ('completion', 'count', 'duration', 'quantity')),
  target_value NUMERIC NOT NULL DEFAULT 1 CHECK (target_value > 0),
  target_unit TEXT,
  frequency_type TEXT NOT NULL DEFAULT 'weekly'
    CHECK (frequency_type IN ('daily', 'weekly')),
  scheduled_days SMALLINT[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4]
    CHECK (array_length(scheduled_days, 1) > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, name)
);

CREATE INDEX IF NOT EXISTS idx_habits_student ON habits (student_id, status);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- Students: own rows only (read + write). WITH CHECK mirrors USING so an
-- insert/update can never target another student's habit.
DROP POLICY IF EXISTS "habits_own_read" ON habits;
CREATE POLICY "habits_own_read" ON habits FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "habits_own_write" ON habits;
CREATE POLICY "habits_own_write" ON habits FOR ALL USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

-- Admins: full access within their school (same pattern as habit_entries).
DROP POLICY IF EXISTS "habits_admin_read" ON habits;
CREATE POLICY "habits_admin_read" ON habits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habits.school_id
  )
);

DROP POLICY IF EXISTS "habits_admin_write" ON habits;
CREATE POLICY "habits_admin_write" ON habits FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habits.school_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habits.school_id
  )
);

-- Seed the five default habits for every student (idempotent). These match
-- the categories the app shipped with, now with real targets per the product
-- spec: Study 5x/week (Mon-Fri), Exercise 4x/week, Reading 30 min/day,
-- Sleep 8 h/day, Focus 60 min/day.
INSERT INTO habits (school_id, student_id, name, description, category, icon,
                    goal_type, target_value, target_unit, frequency_type, scheduled_days)
SELECT p.school_id, p.id, d.name, d.description, d.category, d.icon,
       d.goal_type, d.target_value, d.target_unit, d.frequency_type, d.scheduled_days
FROM profiles p
CROSS JOIN (VALUES
  ('Study',    'Sessions of focused schoolwork or review', 'study',    'study',    'completion', 5,   'times',   'weekly', ARRAY[0,1,2,3,4]),
  ('Exercise', 'Physical activity, workouts, or movement', 'exercise', 'exercise', 'count',      4,   'times',   'weekly', ARRAY[0,1,2,3,4,5,6]),
  ('Reading',  'Reading for class or for yourself',        'reading',  'reading',  'duration',   30,  'minutes', 'daily',  ARRAY[0,1,2,3,4,5,6]),
  ('Sleep',    'A full night of rest before a school day', 'sleep',    'sleep',    'duration',   8,   'hours',   'daily',  ARRAY[0,1,2,3,4,5,6]),
  ('Focus',    'Deep, distraction-free work blocks',       'focus',    'focus',    'duration',   60,  'minutes', 'daily',  ARRAY[0,1,2,3,4,5,6])
) AS d(name, description, category, icon, goal_type, target_value, target_unit, frequency_type, scheduled_days)
WHERE p.role = 'student'
ON CONFLICT (student_id, name) DO NOTHING;

-- Re-key habit_entries onto habits.id, preserving every existing entry.
ALTER TABLE habit_entries ADD COLUMN IF NOT EXISTS habit_id UUID REFERENCES habits(id) ON DELETE CASCADE;
ALTER TABLE habit_entries ADD COLUMN IF NOT EXISTS value NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE habit_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill legacy rows (keyed on habit_type) to the seeded default habit of
-- the same category.
UPDATE habit_entries e
SET habit_id = h.id
FROM habits h
WHERE e.student_id = h.student_id
  AND e.habit_type = h.category
  AND e.habit_id IS NULL;

-- Any legacy row that could not be matched (should not happen) is dropped
-- rather than left dangling without a habit.
DELETE FROM habit_entries WHERE habit_id IS NULL;

-- Uniqueness moves from (student, habit_type, date) to (student, habit, date):
-- one record per habit per day, enforced at the database level so the client
-- can never create duplicate daily records.
ALTER TABLE habit_entries DROP CONSTRAINT IF EXISTS habit_entries_student_id_habit_type_entry_date_key;
ALTER TABLE habit_entries ADD CONSTRAINT habit_entries_student_habit_date_key
  UNIQUE (student_id, habit_id, entry_date);

-- habit_type is fully replaced by habits.category; drop it together with its
-- CHECK constraint.
ALTER TABLE habit_entries DROP COLUMN IF EXISTS habit_type;

-- Pause windows: while a habit is paused its scheduled days are skipped by
-- streak math (a pause never breaks a streak and never generates missed
-- days), and its historical records stay untouched. One open row (ended_at
-- IS NULL) per habit at a time.
CREATE TABLE IF NOT EXISTS habit_pauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  started_at DATE NOT NULL,
  ended_at DATE,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_habit_pauses_habit ON habit_pauses (student_id, habit_id);

ALTER TABLE habit_pauses ENABLE ROW LEVEL SECURITY;

-- Students: own rows only.
DROP POLICY IF EXISTS "habit_pauses_own_read" ON habit_pauses;
CREATE POLICY "habit_pauses_own_read" ON habit_pauses FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "habit_pauses_own_write" ON habit_pauses;
CREATE POLICY "habit_pauses_own_write" ON habit_pauses FOR ALL USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

-- Admins: full access within their school.
DROP POLICY IF EXISTS "habit_pauses_admin_read" ON habit_pauses;
CREATE POLICY "habit_pauses_admin_read" ON habit_pauses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habit_pauses.school_id
  )
);

DROP POLICY IF EXISTS "habit_pauses_admin_write" ON habit_pauses;
CREATE POLICY "habit_pauses_admin_write" ON habit_pauses FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habit_pauses.school_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habit_pauses.school_id
  )
);

-- Publish habits + habit_pauses to realtime so definitions and pause state
-- stay live across tabs (habit_entries is already published by 048).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['habits', 'habit_pauses']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'published %', t;
    END IF;
  END LOOP;
END $$;
