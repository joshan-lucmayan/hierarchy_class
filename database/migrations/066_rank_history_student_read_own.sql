-- ===========================================================================
-- 066_rank_history_student_read_own.sql
-- Tighten rank_history_log SELECT policy: students can only read their own
-- progression history. Admins and teachers retain school-wide read access.
--
-- Previously, rank_history_school_read allowed any authenticated user in the
-- same school to read ALL rank_history_log rows. This was acceptable when
-- the table was only used by admin dashboards, but the student-facing
-- History feature requires student-scoped reads.
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE.
-- ===========================================================================

DROP POLICY IF EXISTS "rank_history_school_read" ON rank_history_log;

-- Admins and teachers: school-wide read (unchanged from before).
-- Students: own rows only (student_id must match their own profile id).
CREATE POLICY "rank_history_school_read" ON rank_history_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.school_id = rank_history_log.school_id
      AND (
        p.role IN ('admin', 'teacher')
        OR rank_history_log.student_id = p.id
      )
  )
);
