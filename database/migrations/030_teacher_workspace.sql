-- 030: Teacher Workspace (pinned notes / schedule / lesson plans)
-- ---------------------------------------------------------------------------
-- Moves the teacher dashboard's notes, schedule, and lesson plans out of
-- localStorage and into real Postgres rows. Previously these lived only in
-- the browser (teacherWorkspaceStore used window.localStorage), so they never
-- synced across devices and were lost on cache clears.
--
-- RLS follows the exact syntax used across the repo (see 029_habit_tracker.sql):
-- teachers get own-row access via the profiles join; admins get full access
-- within their school. Idempotent by design - there is no migration-tracking
-- table, so every statement guards with IF NOT EXISTS / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS teacher_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  plan_date DATE NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_notes_teacher ON teacher_notes (teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_teacher_schedule_teacher ON teacher_schedule (teacher_id, day);
CREATE INDEX IF NOT EXISTS idx_teacher_lesson_plans_teacher ON teacher_lesson_plans (teacher_id, plan_date);

ALTER TABLE teacher_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_lesson_plans ENABLE ROW LEVEL SECURITY;

-- Teachers: own rows only (read + write), via the profiles join. WITH CHECK
-- mirrors USING so an insert/update can never target another teacher's row.
DROP POLICY IF EXISTS "teacher_notes_own_read" ON teacher_notes;
CREATE POLICY "teacher_notes_own_read" ON teacher_notes FOR SELECT USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_notes_own_write" ON teacher_notes;
CREATE POLICY "teacher_notes_own_write" ON teacher_notes FOR ALL USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_schedule_own_read" ON teacher_schedule;
CREATE POLICY "teacher_schedule_own_read" ON teacher_schedule FOR SELECT USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_schedule_own_write" ON teacher_schedule;
CREATE POLICY "teacher_schedule_own_write" ON teacher_schedule FOR ALL USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_lesson_plans_own_read" ON teacher_lesson_plans;
CREATE POLICY "teacher_lesson_plans_own_read" ON teacher_lesson_plans FOR SELECT USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_lesson_plans_own_write" ON teacher_lesson_plans;
CREATE POLICY "teacher_lesson_plans_own_write" ON teacher_lesson_plans FOR ALL USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

-- Admins: full access within their school (read + write), same pattern as the
-- other admin policies in the repo.
DROP POLICY IF EXISTS "teacher_notes_admin_read" ON teacher_notes;
CREATE POLICY "teacher_notes_admin_read" ON teacher_notes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_notes.school_id
  )
);

DROP POLICY IF EXISTS "teacher_notes_admin_write" ON teacher_notes;
CREATE POLICY "teacher_notes_admin_write" ON teacher_notes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_notes.school_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_notes.school_id
  )
);

DROP POLICY IF EXISTS "teacher_schedule_admin_read" ON teacher_schedule;
CREATE POLICY "teacher_schedule_admin_read" ON teacher_schedule FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_schedule.school_id
  )
);

DROP POLICY IF EXISTS "teacher_schedule_admin_write" ON teacher_schedule;
CREATE POLICY "teacher_schedule_admin_write" ON teacher_schedule FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_schedule.school_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_schedule.school_id
  )
);

DROP POLICY IF EXISTS "teacher_lesson_plans_admin_read" ON teacher_lesson_plans;
CREATE POLICY "teacher_lesson_plans_admin_read" ON teacher_lesson_plans FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_lesson_plans.school_id
  )
);

DROP POLICY IF EXISTS "teacher_lesson_plans_admin_write" ON teacher_lesson_plans;
CREATE POLICY "teacher_lesson_plans_admin_write" ON teacher_lesson_plans FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_lesson_plans.school_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_lesson_plans.school_id
  )
);
