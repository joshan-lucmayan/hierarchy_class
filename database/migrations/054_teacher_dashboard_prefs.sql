-- 054: Teacher dashboard preferences (customizable Home layout)
-- ---------------------------------------------------------------------------
-- Presentation-only preferences for the teacher Home command center: which
-- widgets appear and how they are arranged. This table stores NO academic
-- data, permissions, or metrics - just the workflow preference for one
-- teacher's Home.
--
--   layout JSONB shape: { "widgets": [ { "id", "size", "tall", "order" } ] }
--   (the pre-widgets shape { "hidden": [], "order": [] } is normalized
--   by normalizeHomePrefs at read time if still present)
--
-- Like the admin dashboard (055), Teacher Home is EMPTY BY DEFAULT: a
-- missing row / malformed layout normalizes to an empty command center the
-- teacher builds themselves, optionally starting from a developer-created
-- preset (presets are client-side layout definitions and never auto-apply).
--
-- RLS follows the exact syntax used across the repo (see 030_teacher_workspace.sql):
-- teachers get own-row access via the profiles join; admins can read within
-- their school (read-only - a teacher's Home layout is private). Idempotent
-- by design - there is no migration-tracking table, so every statement
-- guards with IF NOT EXISTS / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS teacher_dashboard_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '{"widgets": []}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_dashboard_prefs_teacher ON teacher_dashboard_prefs (teacher_id);

ALTER TABLE teacher_dashboard_prefs ENABLE ROW LEVEL SECURITY;

-- Teachers: own row only (read + write), via the profiles join. WITH CHECK
-- mirrors USING so an insert/update can never target another teacher's row.
DROP POLICY IF EXISTS "teacher_dashboard_prefs_own_read" ON teacher_dashboard_prefs;
CREATE POLICY "teacher_dashboard_prefs_own_read" ON teacher_dashboard_prefs FOR SELECT USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_dashboard_prefs_own_write" ON teacher_dashboard_prefs;
CREATE POLICY "teacher_dashboard_prefs_own_write" ON teacher_dashboard_prefs FOR ALL USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

-- Admins: read within their school only (never write - a teacher's Home
-- layout is personal). Same pattern as the admin read policies in 030.
DROP POLICY IF EXISTS "teacher_dashboard_prefs_admin_read" ON teacher_dashboard_prefs;
CREATE POLICY "teacher_dashboard_prefs_admin_read" ON teacher_dashboard_prefs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = teacher_dashboard_prefs.school_id
  )
);
