-- ===========================================================================
-- 039_participation_grade_type.sql
-- Adds 'Participation' as a valid grade_entries.type (the rank engine's
-- fourth category), so teachers can enter participation scores on the
-- classroom page alongside Quiz / Exam / Activity / Assignment.
--
--   1. Replaces the grade_entries.type CHECK to include 'Participation'.
--   2. Feed trigger maps type 'Participation' -> rank category 'participation'
--      (previously it fell into the ELSE 'activity' bucket).
--
-- Idempotent: DROP CONSTRAINT IF EXISTS + CREATE, CREATE OR REPLACE.
-- ===========================================================================

ALTER TABLE grade_entries DROP CONSTRAINT IF EXISTS grade_entries_type_check;
ALTER TABLE grade_entries ADD CONSTRAINT grade_entries_type_check
  CHECK (type IN ('Exam', 'Quiz', 'Activity', 'Assignment', 'Participation'));

DROP TRIGGER IF EXISTS trg_grade_approved_feeds_rank ON grade_entries;
CREATE OR REPLACE FUNCTION public.feed_approved_grade_to_rank()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_category TEXT;
  v_period TEXT;
  v_weights JSONB;
  v_result JSONB;
  v_revert JSONB;
BEGIN
  -- REJECTION (or any move away from approved after having been fed): undo.
  IF NEW.approval_status IS DISTINCT FROM 'approved'
     AND OLD.approval_status = 'approved'
     AND OLD.rank_fed_at IS NOT NULL THEN
    BEGIN
      v_revert := public.revert_grade_rank_feed(OLD.id);
      NEW.rank_fed_at := NULL;  -- a later re-approval feeds again
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'rank revert skipped for grade %: %', OLD.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  -- FEED on approval (only when not fed before).
  IF NEW.approval_status = 'approved'
     AND OLD.approval_status IS DISTINCT FROM 'approved'
     AND NEW.rank_fed_at IS NULL THEN
    v_category := CASE NEW.type
      WHEN 'Exam' THEN 'exam'
      WHEN 'Quiz' THEN 'quiz'
      WHEN 'Participation' THEN 'participation'
      ELSE 'activity'  -- Activity + Assignment
    END;

    -- Period = the admin-declared ACTIVE semester; fall back to the student's
    -- existing period (or 'Period 1') if no semester has been declared yet.
    SELECT ss.semester_label INTO v_period
    FROM school_semesters ss
    JOIN profiles p ON p.school_id = ss.school_id AND p.id = NEW.student_id
    WHERE ss.status = 'active'
    ORDER BY ss.created_at DESC LIMIT 1;
    IF v_period IS NULL THEN
      SELECT period_id INTO v_period
      FROM student_rank_state WHERE student_id = NEW.student_id;
      v_period := COALESCE(v_period, 'Period 1');
    END IF;

    -- Course weights (percentages) -> fractions for the engine.
    SELECT weights INTO v_weights
    FROM course_rank_weights WHERE course_id = NEW.course_id;
    IF v_weights IS NOT NULL THEN
      v_weights := jsonb_build_object(
        'quiz', (v_weights->>'quiz')::DOUBLE PRECISION / 100,
        'exam', (v_weights->>'exam')::DOUBLE PRECISION / 100,
        'activity', (v_weights->>'activity')::DOUBLE PRECISION / 100,
        'participation', (v_weights->>'participation')::DOUBLE PRECISION / 100);
    END IF;

    BEGIN
      v_result := public.process_score_entry(
        p_student_id      => NEW.student_id,
        p_period_id       => v_period,
        p_category        => v_category,
        p_points_earned   => NEW.score,
        p_points_possible => COALESCE(NEW.max_score, 100),
        p_auto_confirm    => true,
        p_source_grade_id => NEW.id,
        p_weights         => v_weights
      );
      NEW.rank_fed_at := now();
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'rank feed skipped for grade %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_grade_approved_feeds_rank
BEFORE UPDATE OF approval_status ON grade_entries
FOR EACH ROW
WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
EXECUTE FUNCTION public.feed_approved_grade_to_rank();
