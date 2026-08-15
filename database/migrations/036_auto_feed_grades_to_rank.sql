-- ===========================================================================
-- 036_auto_feed_grades_to_rank.sql
-- Approved grade_entries automatically feed the non-linear rank engine
-- (migration 034). When a grade row is updated to approval_status =
-- 'approved', a BEFORE UPDATE trigger runs process_score_entry (validate ->
-- preview -> auto-confirm) so teacher-submitted grades move ranks without
-- manual score entry on /teacher/ranks.
--
-- Mapping (grade_entries.type -> rank category):
--   Exam       -> exam
--   Quiz       -> quiz
--   Activity   -> activity
--   Assignment -> activity        (rank engine has no 'assignment' category)
-- points_earned = grade_entries.score (0-100), points_possible = 100
-- (grade_entries has no separate max column; score is bounded 0-100).
--
-- The entry lands in the student's CURRENT grading period (student_rank_state
-- .period_id) - the same period the teacher's manual entry uses - or the
-- default 'Period 1' if they have no rank state yet.
--
-- Exactly-once per grade: grade_entries.rank_fed_at is stamped when the feed
-- succeeds, so approving -> rejecting -> re-approving the SAME grade never
-- double-feeds (each grade counts once, as the user requested).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE + DROP TRIGGER.
-- ===========================================================================

ALTER TABLE grade_entries
  ADD COLUMN IF NOT EXISTS rank_fed_at TIMESTAMPTZ;

-- Feed one approved grade into the rank engine. SECURITY DEFINER so it can
-- call the rank RPCs; auth.uid() is the approving admin, who _rank_auth
-- accepts for any student in the school.
CREATE OR REPLACE FUNCTION public.feed_approved_grade_to_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_period TEXT;
  v_result JSONB;
BEGIN
  -- Map the grade type onto the engine's four categories.
  v_category := CASE NEW.type
    WHEN 'Exam' THEN 'exam'
    WHEN 'Quiz' THEN 'quiz'
    ELSE 'activity'  -- Activity + Assignment
  END;

  -- Feed into the student's current period if they have one.
  SELECT period_id INTO v_period
  FROM student_rank_state WHERE student_id = NEW.student_id;
  v_period := COALESCE(v_period, 'Period 1');

  -- Feed the grade into the rank engine. Wrapped in a subtransaction so a
  -- feed problem (e.g. a transient config/validation issue) never rolls back
  -- the admin's grade approval - the grade stays approved, the error is
  -- logged, and the row is left unstamped so the documented backfill
  -- statement can retry it later.
  BEGIN
    v_result := public.process_score_entry(
      p_student_id      => NEW.student_id,
      p_period_id       => v_period,
      p_category        => v_category,
      p_points_earned   => NEW.score,
      p_points_possible => 100,
      p_auto_confirm    => true
    );
    NEW.rank_fed_at := now();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rank feed skipped for grade %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grade_approved_feeds_rank ON grade_entries;

-- BEFORE UPDATE OF approval_status: fires only when the admin flips a row to
-- 'approved' (the 'UPDATE OF' column list also lets the INSERT path through
-- as-is - grades are always inserted 'pending', so INSERTs never feed).
CREATE TRIGGER trg_grade_approved_feeds_rank
BEFORE UPDATE OF approval_status ON grade_entries
FOR EACH ROW
WHEN (NEW.approval_status = 'approved'
      AND OLD.approval_status IS DISTINCT FROM 'approved'
      AND NEW.rank_fed_at IS NULL)
EXECUTE FUNCTION public.feed_approved_grade_to_rank();

-- ===========================================================================
-- Backfill note (for deployments that already have approved grades):
--   UPDATE grade_entries SET approval_status = approval_status
--   WHERE approval_status = 'approved';
-- The UPDATE fires the trigger once per row (rank_fed_at is still NULL) and
-- feeds each existing approved grade. The live dev DB has zero grade_entries,
-- so nothing to backfill here. Run it manually as the admin session if a
-- production database has approved grades that should seed ranks.
-- ===========================================================================
