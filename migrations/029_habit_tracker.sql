-- 029: Habit Tracker
-- ---------------------------------------------------------------------------
-- Per-student weekly habit tracking (study / exercise / reading / sleep / focus).
-- A student may log at most one entry per habit per day; toggling an existing
-- entry removes it (the app treats "present" as completed, so there is no
-- separate 'uncompleted' row - deletion is how a day is unmarked).
--
-- RLS follows the exact syntax used across the repo (see 006_classroom_hierarchy.sql
-- and 023_messaging_blocks.sql): school-scoped via auth.jwt() user_metadata for
-- admins, own-row access via the profiles join for students. Students can only
-- read/write their OWN rows - cross-student access is denied at the policy level.
--
-- Idempotent by design: there is no migration-tracking table in this project, so
-- every statement guards with IF NOT EXISTS / DROP POLICY IF EXISTS and can be
-- re-run safely.

CREATE TABLE IF NOT EXISTS habit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_type TEXT NOT NULL CHECK (habit_type IN ('study', 'exercise', 'reading', 'sleep', 'focus')),
  entry_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, habit_type, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_entries_student ON habit_entries (student_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_habit_entries_school ON habit_entries (school_id);

ALTER TABLE habit_entries ENABLE ROW LEVEL SECURITY;

-- Students: own rows only (read + write). WITH CHECK mirrors USING so an insert
-- or update can never target another student's row.
DROP POLICY IF EXISTS "habit_entries_own_read" ON habit_entries;
CREATE POLICY "habit_entries_own_read" ON habit_entries FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "habit_entries_own_write" ON habit_entries;
CREATE POLICY "habit_entries_own_write" ON habit_entries FOR ALL USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

-- Admins: full access within their school (read + write), same pattern as the
-- other admin policies in the repo.
DROP POLICY IF EXISTS "habit_entries_admin_read" ON habit_entries;
CREATE POLICY "habit_entries_admin_read" ON habit_entries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habit_entries.school_id
  )
);

DROP POLICY IF EXISTS "habit_entries_admin_write" ON habit_entries;
CREATE POLICY "habit_entries_admin_write" ON habit_entries FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habit_entries.school_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = habit_entries.school_id
  )
);
