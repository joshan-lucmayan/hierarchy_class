-- ===========================================================================
-- 035_admin_rank_ops.sql
-- School-wide rank operations for admins:
--   - end_season_for_school: reseed EVERY student's rank when the season ends
--     (first semester over, controlled by admin). Pulls grade level / strand /
--     section from each student's profile and writes a season_history_log per
--     student (peak-based reseed - see 034).
--   - get_school_season_history: all season logs for a school, for the admin
--     season-history view.
-- Idempotent: CREATE OR REPLACE FUNCTION only.
-- ===========================================================================

-- Reseed the whole school's ranks at season end. Admin only.
CREATE OR REPLACE FUNCTION public.end_season_for_school(
  p_school_id UUID,
  p_season_id TEXT DEFAULT NULL,
  p_school_year TEXT DEFAULT NULL,
  p_semester_label TEXT DEFAULT NULL,
  p_season_end_date TIMESTAMPTZ DEFAULT now())
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_season_id TEXT;
  v_count INT := 0;
  v_results JSONB := '[]'::jsonb;
  v_result JSONB;
  v_student RECORD;
BEGIN
  -- Only an admin of this school may end a season.
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_role <> 'admin' OR v_school IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'Only admins of this school can end a season';
  END IF;

  IF p_school_year IS NULL OR p_semester_label IS NULL THEN
    RAISE EXCEPTION 'school_year and semester_label are required';
  END IF;
  v_season_id := COALESCE(NULLIF(trim(p_season_id), ''), p_school_year || ' ' || p_semester_label);

  -- Only students that actually have rank state get reseeded; a student with
  -- no state has nothing to carry over.
  FOR v_student IN
    SELECT p.id AS student_id,
           p.educational_level,
           p.program,
           p.level_label
    FROM profiles p
    WHERE p.school_id = p_school_id
      AND p.role = 'student'
      AND EXISTS (SELECT 1 FROM student_rank_state s WHERE s.student_id = p.id)
  LOOP
    v_result := public.end_season(
      v_student.student_id,
      v_season_id,
      p_school_year,
      p_semester_label,
      COALESCE(v_student.educational_level, ''),
      v_student.program,
      v_student.level_label,
      p_season_end_date);
    v_count := v_count + 1;
    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN jsonb_build_object(
    'season_id', v_season_id,
    'ended', v_count,
    'school_year', p_school_year,
    'semester_label', p_semester_label,
    'results', v_results);
END $$;

-- All season logs for a school (for the admin season-history view).
CREATE OR REPLACE FUNCTION public.get_school_season_history(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_result JSONB;
BEGIN
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_school IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.season_end_date DESC), '[]'::jsonb) INTO v_result
  FROM (
    SELECT sl.student_id, sl.season_id, sl.school_year, sl.semester_label, sl.grade_level,
           sl.strand_or_track, sl.section, sl.peak_rank, sl.final_rank_before_reset,
           sl.reset_to_rank, sl.ex_achieved, sl.season_end_date,
           p.full_name
    FROM season_history_log sl
    JOIN profiles p ON p.id = sl.student_id
    WHERE sl.school_id = p_school_id
  ) t;
  RETURN v_result;
END $$;
