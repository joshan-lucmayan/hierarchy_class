-- 055: Admin dashboard preferences (customizable Home command center)
-- ---------------------------------------------------------------------------
-- Presentation-only preferences for the Admin Home: which school-wide
-- widgets appear and how they are arranged. This table stores NO academic
-- data, permissions, or metrics - just the workflow preference for one
-- admin's Home.
--
--   layout JSONB shape: { "widgets": [ { "id", "size", "tall", "order" } ] }
--
-- Like the teacher dashboard, Admin Home is EMPTY BY DEFAULT: a missing
-- row / malformed layout normalizes to an empty command center the admin
-- builds themselves, optionally starting from a developer-created preset
-- (presets are client-side layout definitions and never auto-apply).
--
-- RLS follows the exact syntax used across the repo (see 054): the admin
-- gets own-row access via the profiles join. An admin's dashboard
-- preference is personal - there is no cross-admin read. Idempotent by
-- design - every statement guards with IF NOT EXISTS / DROP POLICY IF
-- EXISTS.

CREATE TABLE IF NOT EXISTS admin_dashboard_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '{"widgets": []}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_dashboard_prefs_admin ON admin_dashboard_prefs (admin_id);

ALTER TABLE admin_dashboard_prefs ENABLE ROW LEVEL SECURITY;

-- Admin: own row only (read + write), via the profiles join. WITH CHECK
-- mirrors USING so an insert/update can never target another admin's row.
DROP POLICY IF EXISTS "admin_dashboard_prefs_own_read" ON admin_dashboard_prefs;
CREATE POLICY "admin_dashboard_prefs_own_read" ON admin_dashboard_prefs FOR SELECT USING (
  admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "admin_dashboard_prefs_own_write" ON admin_dashboard_prefs;
CREATE POLICY "admin_dashboard_prefs_own_write" ON admin_dashboard_prefs FOR ALL USING (
  admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (
  admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);
