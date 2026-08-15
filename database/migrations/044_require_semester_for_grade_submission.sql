-- ===========================================================================
-- 044_require_semester_for_grade_submission.sql
-- Security gate: a teacher/professor CANNOT submit grades until the school has
-- an ACTIVE semester. The admin starts it on /admin/ranks (declare_semester).
--
-- This is enforced at the DATABASE level (BEFORE INSERT on grade_entries), so
-- it cannot be bypassed from any client. The UI also pre-checks
-- get_active_semester and shows the teacher a friendly "contact your admin"
-- message instead of a raw DB error.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.guard_grade_submission_requires_semester()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_semester BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM school_semesters ss
    WHERE ss.school_id = NEW.school_id AND ss.status = 'active'
  ) INTO v_has_semester;

  IF NOT v_has_semester THEN
    RAISE EXCEPTION 'No active semester yet - ask your admin to start the semester before submitting grades'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grade_requires_semester ON grade_entries;
CREATE TRIGGER trg_grade_requires_semester
BEFORE INSERT ON grade_entries
FOR EACH ROW
EXECUTE FUNCTION public.guard_grade_submission_requires_semester();
