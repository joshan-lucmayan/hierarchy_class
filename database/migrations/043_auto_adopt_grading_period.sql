-- ===========================================================================
-- 043_auto_adopt_grading_period.sql
-- Fixes "grading another category (e.g. Exam) makes no changes".
--
-- Root cause: the admin declares a semester AFTER the first grades were fed
-- under the 'Period 1' fallback. The feed then targets the active semester
-- label ('First Semester') while the student's state is still on 'Period 1',
-- so confirm_and_apply_score_entry raised "Period mismatch" and the trigger
-- silently skipped every later grade (rank_fed_at stayed NULL).
--
--   1. confirm_and_apply_score_entry now ADOPTS the caller's grading period
--      when it differs: the rank/bar carry over unchanged, the new period's
--      entries form the fresh composite, and old-period entries stay for
--      history (exactly the period-boundary semantics of
--      reset_period_category_totals, minus the clearing).
--   2. Backfill: every APPROVED grade whose rank_fed_at is NULL is fed now
--      (category via the course's label -> key map, period = active semester,
--      course weights), running as an admin of the grade's school so the
--      auth-gated engine RPCs work. Failures are logged, never abort.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + guarded DO.
-- ===========================================================================

-- 1) confirm_and_apply_score_entry: adopt the new period instead of raising --
CREATE OR REPLACE FUNCTION public.confirm_and_apply_score_entry(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_preview_token TEXT,
  p_source_grade_id UUID DEFAULT NULL, p_weights JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_cfg JSONB;
  v_state student_rank_state%ROWTYPE;
  v_valid JSONB;
  v_warnings JSONB := '[]'::jsonb;
  v_preview JSONB;
  v_expected_token TEXT;
  v_s DOUBLE PRECISION;
  v_adjusted DOUBLE PRECISION;
  v_capped DOUBLE PRECISION;
  v_fill DOUBLE PRECISION;
  v_n DOUBLE PRECISION;
  v_update JSONB;
  v_ex_before INT;
  v_ex_after INT;
  v_new_rank TEXT;
  v_new_bar DOUBLE PRECISION;
  v_promoted BOOLEAN := false;
  v_demoted BOOLEAN := false;
  v_cascade INT := 0;
  v_event TEXT;
  v_new_peak TEXT;
  v_bar_before DOUBLE PRECISION;
  v_rank_before TEXT;
  v_peak_before TEXT;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, true);
  v_cfg := public.get_rank_config(v_school);
  IF p_weights IS NOT NULL THEN
    v_cfg := jsonb_set(v_cfg, '{weights}', p_weights);
  END IF;
  v_state := public._rank_ensure_state(p_student_id);
  v_rank_before := v_state.current_rank;
  v_peak_before := v_state.peak_rank_this_season;

  -- Period bookkeeping: the caller's grading period wins. When it differs
  -- (e.g. the admin declared a semester after earlier entries were fed under
  -- the 'Period 1' fallback), the state ADOPTS it: rank/bar carry over, this
  -- period's entries form the fresh composite, old-period entries stay for
  -- history. No more "Period mismatch" dead-end.
  IF v_state.period_id IS NULL OR v_state.period_id IS DISTINCT FROM p_period_id THEN
    UPDATE student_rank_state SET period_id = p_period_id, updated_at = now()
    WHERE student_id = p_student_id;
    v_state := public._rank_ensure_state(p_student_id);
  END IF;

  -- Re-validate (Section 11): reject silently-invalid inputs.
  v_valid := public._rank_validate(p_points_earned, p_points_possible, p_category, p_period_id, p_student_id, v_warnings);
  IF NOT (v_valid->>'valid')::boolean THEN
    RAISE EXCEPTION 'Invalid score entry: %', (v_valid->'warnings')::text;
  END IF;

  -- Preview token must match a fresh computation (no stale previews).
  v_expected_token := public._rank_token(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, v_cfg);
  IF p_preview_token IS NULL OR p_preview_token <> v_expected_token THEN
    RAISE EXCEPTION 'Preview token mismatch - re-preview before confirming';
  END IF;

  v_preview := public.preview_rank_update(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, p_weights);
  v_bar_before := v_state.current_bar;
  v_ex_before := v_state.ex_score;

  INSERT INTO rank_period_entries (school_id, student_id, period_id, category, points_earned, points_possible,
    source_grade_id, rank_before, bar_before, ex_score_before, peak_before, weights)
  VALUES (v_school, p_student_id, p_period_id, p_category, p_points_earned, p_points_possible,
    p_source_grade_id, v_rank_before, v_bar_before, v_ex_before, v_peak_before, p_weights);

  IF v_state.current_rank = 'EX' THEN
    -- Section 6: open-ended score moves, rank never changes.
    IF (v_preview->>'adjusted_uncapped')::DOUBLE PRECISION >= 50 THEN
      v_ex_after := v_ex_before + (v_cfg->>'ex_step')::INT;
    ELSE
      v_ex_after := GREATEST(0, v_ex_before - (v_cfg->>'ex_step')::INT);
    END IF;
    v_new_rank := 'EX';
    v_new_bar := 0;
    v_event := 'ex_score';
    UPDATE student_rank_state
    SET ex_score = v_ex_after, updated_at = now()
    WHERE student_id = p_student_id;
  ELSE
    v_s := (v_preview->>'S')::DOUBLE PRECISION;
    v_adjusted := (v_preview->>'adjusted_uncapped')::DOUBLE PRECISION;
    v_capped := (v_preview->>'adjusted_capped')::DOUBLE PRECISION;
    v_n := COALESCE((SELECT (t->>'n')::DOUBLE PRECISION FROM jsonb_array_elements(v_cfg->'tiers') t
                     WHERE t->>'rank' = v_state.current_rank LIMIT 1), 1);
    v_fill := ((v_capped - 50) / 50.0) * (100.0 / v_n);
    v_update := public._rank_apply_update(v_state.current_rank, v_bar_before, v_fill, v_cfg->'tiers');
    v_new_rank := v_update->>'new_rank';
    v_new_bar := (v_update->>'new_bar')::DOUBLE PRECISION;
    v_promoted := (v_update->>'promoted')::boolean;
    v_demoted := (v_update->>'demoted')::boolean;
    v_cascade := (v_update->>'cascade_tiers')::INT;
    v_ex_after := v_ex_before;
    v_event := CASE WHEN v_promoted THEN 'promotion' WHEN v_demoted THEN 'demotion' ELSE 'update' END;

    v_new_peak := v_state.peak_rank_this_season;
    IF v_promoted AND public._rank_order(v_new_rank) > public._rank_order(v_new_peak) THEN
      v_new_peak := v_new_rank;
    END IF;
    IF v_new_rank = 'EX' THEN
      -- First reaching EX (or re-reaching after a season reset): fresh run.
      v_ex_after := 0;
    END IF;

    UPDATE student_rank_state
    SET current_rank = v_new_rank,
        current_bar = v_new_bar,
        ex_score = v_ex_after,
        peak_rank_this_season = v_new_peak,
        updated_at = now()
    WHERE student_id = p_student_id;
  END IF;

  INSERT INTO rank_history_log (school_id, student_id, period_id, category, points_earned, points_possible,
    s_score, adjusted, rank_before, rank_after, bar_before, bar_after, ex_score_before, ex_score_after,
    event_type, cascade_tiers)
  VALUES (v_school, p_student_id, p_period_id, p_category, p_points_earned, p_points_possible,
    (v_preview->>'S')::DOUBLE PRECISION, (v_preview->>'adjusted_uncapped')::DOUBLE PRECISION,
    v_state.current_rank, v_new_rank, v_bar_before, v_new_bar, v_ex_before, v_ex_after,
    v_event, v_cascade);

  v_state := public._rank_ensure_state(p_student_id);
  RETURN jsonb_build_object(
    'valid', true, 'warnings', v_valid->'warnings',
    'event', jsonb_build_object(
      'type', v_event, 'promoted', v_promoted, 'demoted', v_demoted, 'cascade_tiers', v_cascade,
      'rank_before', v_rank_before, 'bar_before', v_bar_before, 'bar_after', v_new_bar),
    'state', jsonb_build_object(
      'student_id', p_student_id,
      'current_rank', v_state.current_rank,
      'current_bar', v_state.current_bar,
      'ex_score', v_state.ex_score,
      'peak_rank_this_season', v_state.peak_rank_this_season,
      'highest_rank_ever', v_state.highest_rank_ever,
      'highest_rank_season', v_state.highest_rank_season,
      'period_id', v_state.period_id,
      'season_id', v_state.season_id));
END $$;

-- 2) Backfill approved-but-unfed grades ---------------------------------------
DO $$
DECLARE
  v_grade RECORD;
  v_admin UUID;
  v_period TEXT;
  v_category TEXT;
  v_weights JSONB;
  v_result JSONB;
BEGIN
  FOR v_grade IN
    SELECT ge.id, ge.school_id, ge.course_id, ge.student_id, ge.type, ge.score, ge.max_score
    FROM grade_entries ge
    WHERE ge.approval_status = 'approved' AND ge.rank_fed_at IS NULL
    ORDER BY ge.created_at
  LOOP
    -- Run as an admin of the grade's school so the auth-gated engine RPCs work.
    SELECT user_id INTO v_admin
    FROM profiles WHERE school_id = v_grade.school_id AND role = 'admin' LIMIT 1;
    IF v_admin IS NULL THEN
      RAISE NOTICE 'backfill: no admin for school %, skipping grade %', v_grade.school_id, v_grade.id;
      CONTINUE;
    END IF;
    PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- Category key: the course's label -> key map, legacy fallback otherwise.
    SELECT crc.category_key INTO v_category
    FROM course_rank_categories crc WHERE crc.course_id = v_grade.course_id AND crc.label = v_grade.type;
    IF v_category IS NULL THEN
      v_category := CASE v_grade.type
        WHEN 'Exam' THEN 'exam'
        WHEN 'Quiz' THEN 'quiz'
        WHEN 'Participation' THEN 'participation'
        ELSE 'activity'
      END;
    END IF;

    -- Period: the active semester, else the student's current period.
    SELECT ss.semester_label INTO v_period
    FROM school_semesters ss
    JOIN profiles p ON p.school_id = ss.school_id AND p.id = v_grade.student_id
    WHERE ss.status = 'active'
    ORDER BY ss.created_at DESC LIMIT 1;
    IF v_period IS NULL THEN
      SELECT period_id INTO v_period FROM student_rank_state WHERE student_id = v_grade.student_id;
      v_period := COALESCE(v_period, 'Period 1');
    END IF;

    -- Course weights (fractions), or NULL for the school default.
    SELECT COALESCE(jsonb_object_agg(crc.category_key, crc.weight / 100.0), NULL)
    INTO v_weights
    FROM course_rank_categories crc WHERE crc.course_id = v_grade.course_id;

    BEGIN
      v_result := public.process_score_entry(
        p_student_id      => v_grade.student_id,
        p_period_id       => v_period,
        p_category        => v_category,
        p_points_earned   => v_grade.score,
        p_points_possible => COALESCE(v_grade.max_score, 100),
        p_auto_confirm    => true,
        p_source_grade_id => v_grade.id,
        p_weights         => v_weights
      );
      IF (v_result->>'valid')::boolean AND v_result->'confirmed' IS NOT NULL THEN
        UPDATE grade_entries SET rank_fed_at = now() WHERE id = v_grade.id;
        RAISE NOTICE 'backfill: fed grade % (% %) into period %', v_grade.id, v_category, v_grade.score, v_period;
      ELSE
        RAISE NOTICE 'backfill: grade % rejected (%); not stamped', v_grade.id, (v_result->'warnings')::text;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill: grade % failed: %; not stamped', v_grade.id, SQLERRM;
    END;
  END LOOP;
END $$;
