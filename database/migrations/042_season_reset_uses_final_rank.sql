-- ===========================================================================
-- 042_season_reset_uses_final_rank.sql
-- Season-end reseeding now keys off the student's FINAL rank (the rank at the
-- literal season close), NOT the season peak. So reaching S mid-season but
-- ending at A resets to D (map[A]), exactly as the school expects.
--
-- The PEAK rank is NOT discarded: it stays in season_history_log (peak_rank),
-- it drives the monotonic highest_rank_ever / highest_rank_season all-time
-- record, and it sets ex_achieved. Only the reset itself uses the final rank.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.end_season(
  p_student_id UUID,
  p_season_id TEXT,
  p_school_year TEXT,
  p_semester_label TEXT,
  p_grade_level TEXT,
  p_strand_or_track TEXT DEFAULT NULL,
  p_section TEXT DEFAULT NULL,
  p_season_end_date TIMESTAMPTZ DEFAULT now())
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_state student_rank_state%ROWTYPE;
  v_peak TEXT;
  v_final TEXT;
  v_reset_to TEXT;
  v_cfg JSONB;
  v_log_id UUID;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, true);
  v_state := public._rank_ensure_state(p_student_id);
  v_cfg := public.get_rank_config(v_school);

  v_peak := v_state.peak_rank_this_season;
  v_final := v_state.current_rank;
  -- Reseed from the FINAL rank: a late-season demotion decides where you land.
  v_reset_to := v_cfg->'season_reset_map'->>v_final;
  IF v_reset_to IS NULL THEN
    RAISE EXCEPTION 'Missing season reset mapping for rank %', v_final;
  END IF;

  -- All-time record: only ever increases, from the PEAK (kept in history even
  -- though it does not decide the reset).
  IF public._rank_order(v_peak) > public._rank_order(v_state.highest_rank_ever) THEN
    UPDATE student_rank_state
    SET highest_rank_ever = v_peak, highest_rank_season = p_season_id, updated_at = now()
    WHERE student_id = p_student_id;
  END IF;

  INSERT INTO season_history_log (school_id, student_id, season_id, school_year, semester_label, grade_level,
    strand_or_track, section, peak_rank, final_rank_before_reset, reset_to_rank, ex_achieved, season_end_date)
  VALUES (v_school, p_student_id, p_season_id, p_school_year, p_semester_label, p_grade_level,
    p_strand_or_track, p_section, v_peak, v_final, v_reset_to, v_peak = 'EX', p_season_end_date)
  RETURNING id INTO v_log_id;

  UPDATE student_rank_state
  SET current_rank = v_reset_to, current_bar = 0,
      peak_rank_this_season = v_reset_to, season_id = p_season_id, updated_at = now()
  WHERE student_id = p_student_id;

  INSERT INTO rank_history_log (school_id, student_id, period_id, rank_before, rank_after, event_type)
  VALUES (v_school, p_student_id, NULL, v_final, v_reset_to, 'season_reset');

  v_state := public._rank_ensure_state(p_student_id);
  RETURN jsonb_build_object(
    'log', jsonb_build_object('id', v_log_id, 'peak_rank', v_peak, 'final_rank_before_reset', v_final,
      'reset_to_rank', v_reset_to, 'ex_achieved', v_peak = 'EX', 'season_end_date', p_season_end_date),
    'state', jsonb_build_object(
      'current_rank', v_state.current_rank, 'current_bar', v_state.current_bar, 'ex_score', v_state.ex_score,
      'peak_rank_this_season', v_state.peak_rank_this_season, 'highest_rank_ever', v_state.highest_rank_ever,
      'highest_rank_season', v_state.highest_rank_season, 'season_id', v_state.season_id));
END $$;
