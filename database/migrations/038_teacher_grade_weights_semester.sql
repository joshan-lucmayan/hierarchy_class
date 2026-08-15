-- ===========================================================================
-- 038_teacher_grade_weights_semester.sql
-- Moves rank-score entry OUT of the teacher flow and into the existing
-- classroom grade submission, per the product change:
--
--   1. grade_entries.max_score - teachers now enter an earned score AND the
--      "out of" max (e.g. 24 out of 50). The auto-feed (036/037) uses
--      score/max_score as points_earned/points_possible instead of score/100.
--   2. course_rank_weights - per-course category weights (percentages) the
--      teacher configures on the classroom page, summing to 100%. When a
--      grade from that course auto-feeds the rank engine, its composite S is
--      computed with the course's weights (school config is the fallback).
--   3. school_semesters - the ADMIN declares the semester (start/end dates,
--      school year, label). The feed uses the active semester's label as the
--      grading period, so there is NO teacher-facing "new grading period".
--   4. Engine RPCs (preview/confirm/process) accept an optional p_weights
--      JSONB (default NULL = school rank_config weights) so per-course
--      weights flow through the stateless preview token unchanged.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- DROP POLICY/FUNCTION IF EXISTS, CREATE OR REPLACE.
-- ===========================================================================

-- 1) "Out of" max score on grades ---------------------------------------------
ALTER TABLE grade_entries
  ADD COLUMN IF NOT EXISTS max_score INT NOT NULL DEFAULT 100 CHECK (max_score > 0);

-- The weights used when this entry was applied, so reverts replay with the
-- SAME weights (course weights may differ from the school default).
ALTER TABLE rank_period_entries
  ADD COLUMN IF NOT EXISTS weights JSONB;

-- 2) Per-course category weights ----------------------------------------------
CREATE TABLE IF NOT EXISTS course_rank_weights (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  weights JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_weights_school ON course_rank_weights(school_id);

ALTER TABLE course_rank_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_weights_school_read" ON course_rank_weights;
CREATE POLICY "course_weights_school_read" ON course_rank_weights FOR SELECT USING (
  EXISTS (SELECT 1 FROM courses c JOIN profiles p ON p.school_id = c.school_id
          WHERE c.id = course_rank_weights.course_id AND p.user_id = auth.uid())
);
DROP POLICY IF EXISTS "course_weights_teacher_write" ON course_rank_weights;
CREATE POLICY "course_weights_teacher_write" ON course_rank_weights FOR ALL USING (
  EXISTS (SELECT 1 FROM courses c
          WHERE c.id = course_rank_weights.course_id
            AND (c.teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
                 OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = c.school_id)))
);

-- 3) School semesters (admin-declared) ----------------------------------------
CREATE TABLE IF NOT EXISTS school_semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL,
  semester_label TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_school_semesters_school ON school_semesters(school_id, status);

ALTER TABLE school_semesters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_semesters_school_read" ON school_semesters;
CREATE POLICY "school_semesters_school_read" ON school_semesters FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = school_semesters.school_id)
);
DROP POLICY IF EXISTS "school_semesters_admin_write" ON school_semesters;
CREATE POLICY "school_semesters_admin_write" ON school_semesters FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = school_semesters.school_id)
);

-- 4) Engine RPCs accept optional p_weights ------------------------------------
-- (Signature changes: drop the old overloads first.)

DROP FUNCTION IF EXISTS public.preview_rank_update(uuid, text, text, int, int);
CREATE OR REPLACE FUNCTION public.preview_rank_update(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_weights JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_cfg JSONB;
  v_state student_rank_state%ROWTYPE;
  v_valid JSONB;
  v_pcts JSONB;
  v_s DOUBLE PRECISION;
  v_adjusted DOUBLE PRECISION;
  v_capped DOUBLE PRECISION;
  v_fill DOUBLE PRECISION;
  v_n DOUBLE PRECISION;
  v_update JSONB;
  v_warnings JSONB := '[]'::jsonb;
  v_ex_after INT;
  v_bar_before DOUBLE PRECISION;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, false);
  v_cfg := public.get_rank_config(v_school);
  IF p_weights IS NOT NULL THEN
    v_cfg := jsonb_set(v_cfg, '{weights}', p_weights);
  END IF;
  -- Preview is strictly read-only: if the student has no rank state yet, compute
  -- against the defaults (rank C, bar 0) without creating any row.
  SELECT * INTO v_state FROM student_rank_state WHERE student_id = p_student_id;
  IF NOT FOUND THEN
    v_state.student_id := p_student_id;
    v_state.school_id := v_school;
    v_state.current_rank := 'C';
    v_state.current_bar := 0;
    v_state.ex_score := 0;
    v_state.peak_rank_this_season := 'C';
    v_state.highest_rank_ever := 'C';
  END IF;
  v_bar_before := v_state.current_bar;

  v_valid := public._rank_validate(p_points_earned, p_points_possible, p_category, p_period_id, p_student_id, v_warnings);
  v_warnings := v_valid->'warnings';
  IF NOT (v_valid->>'valid')::boolean THEN
    RETURN jsonb_build_object('valid', false, 'warnings', v_warnings, 'token', null);
  END IF;

  -- Category percentages (Section 2), including the prospective entry.
  SELECT COALESCE(jsonb_object_agg(cat, pct), '{}'::jsonb) INTO v_pcts
  FROM (
    SELECT e.category AS cat,
           (COALESCE(SUM(r.points_earned), 0) + CASE WHEN e.category = p_category THEN p_points_earned ELSE 0 END)::DOUBLE PRECISION
           / NULLIF(COALESCE(SUM(r.points_possible), 0) + CASE WHEN e.category = p_category THEN p_points_possible ELSE 0 END, 0)
           * 100 AS pct
    FROM (SELECT DISTINCT category FROM rank_period_entries
          WHERE student_id = p_student_id AND period_id = p_period_id
          UNION SELECT p_category) e
    LEFT JOIN rank_period_entries r
      ON r.student_id = p_student_id AND r.period_id = p_period_id AND r.category = e.category
    GROUP BY e.category
  ) t WHERE pct IS NOT NULL;

  -- Composite (Section 3): weighted mean of the active category percentages.
  SELECT COALESCE(SUM((w.val)::DOUBLE PRECISION * (p.val)::DOUBLE PRECISION) / NULLIF(SUM((w.val)::DOUBLE PRECISION), 0), NULL)
  INTO v_s
  FROM jsonb_each_text(v_pcts) p(cat, val)
  JOIN jsonb_each_text(v_cfg->'weights') w(wcat, val) ON w.wcat = p.cat;

  IF v_s IS NULL THEN
    RETURN jsonb_build_object(
      'valid', true, 'warnings', v_warnings,
      'S', null, 'adjusted', null, 'adjusted_capped', null, 'adjusted_uncapped', null,
      'fill_change', null, 'bar_before', v_bar_before, 'bar_after', v_bar_before,
      'rank_before', v_state.current_rank, 'rank_after', v_state.current_rank,
      'promoted', false, 'demoted', false, 'cascade_tiers', 0, 'ex_score_after', null,
      'token', public._rank_token(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, v_cfg));
  END IF;

  v_adjusted := 100 * power(v_s / 100.0, (v_cfg->>'k')::DOUBLE PRECISION);
  v_capped := LEAST(v_adjusted, 100);

  -- EX: open-ended score only (Section 6).
  IF v_state.current_rank = 'EX' THEN
    IF v_adjusted >= 50 THEN
      v_ex_after := v_state.ex_score + (v_cfg->>'ex_step')::INT;
    ELSE
      v_ex_after := GREATEST(0, v_state.ex_score - (v_cfg->>'ex_step')::INT);
    END IF;
    RETURN jsonb_build_object(
      'valid', true, 'warnings', v_warnings,
      'S', v_s, 'adjusted', v_adjusted, 'adjusted_capped', v_capped, 'adjusted_uncapped', v_adjusted,
      'fill_change', null, 'bar_before', v_bar_before, 'bar_after', v_bar_before,
      'rank_before', 'EX', 'rank_after', 'EX',
      'promoted', false, 'demoted', false, 'cascade_tiers', 0, 'ex_score_after', v_ex_after,
      'token', public._rank_token(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, v_cfg));
  END IF;

  v_n := COALESCE((SELECT (t->>'n')::DOUBLE PRECISION FROM jsonb_array_elements(v_cfg->'tiers') t
                   WHERE t->>'rank' = v_state.current_rank LIMIT 1), 1);
  v_fill := ((v_capped - 50) / 50.0) * (100.0 / v_n);
  v_update := public._rank_apply_update(v_state.current_rank, v_bar_before, v_fill, v_cfg->'tiers');

  RETURN jsonb_build_object(
    'valid', true, 'warnings', v_warnings,
    'S', v_s, 'adjusted', v_adjusted, 'adjusted_capped', v_capped, 'adjusted_uncapped', v_adjusted,
    'fill_change', v_fill, 'bar_before', v_bar_before, 'bar_after', (v_update->>'new_bar')::DOUBLE PRECISION,
    'rank_before', v_state.current_rank, 'rank_after', v_update->>'new_rank',
    'promoted', (v_update->>'promoted')::boolean, 'demoted', (v_update->>'demoted')::boolean,
    'cascade_tiers', (v_update->>'cascade_tiers')::INT, 'ex_score_after', null,
    'token', public._rank_token(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, v_cfg));
END $$;

DROP FUNCTION IF EXISTS public.confirm_and_apply_score_entry(uuid, text, text, int, int, text, uuid);
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

  -- Period bookkeeping: entries belong to the student's CURRENT period.
  IF v_state.period_id IS NULL THEN
    UPDATE student_rank_state SET period_id = p_period_id, updated_at = now()
    WHERE student_id = p_student_id;
    v_state := public._rank_ensure_state(p_student_id);
  ELSIF v_state.period_id IS DISTINCT FROM p_period_id THEN
    RAISE EXCEPTION 'Period mismatch - call reset_period_category_totals first';
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

DROP FUNCTION IF EXISTS public.process_score_entry(uuid, text, text, int, int, boolean, uuid);
CREATE OR REPLACE FUNCTION public.process_score_entry(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_auto_confirm BOOLEAN DEFAULT false,
  p_source_grade_id UUID DEFAULT NULL, p_weights JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_valid JSONB;
  v_me UUID; v_role TEXT; v_school UUID;
  v_cfg JSONB;
  v_warnings JSONB := '[]'::jsonb;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, true);
  v_cfg := public.get_rank_config(v_school);
  IF p_weights IS NOT NULL THEN
    v_cfg := jsonb_set(v_cfg, '{weights}', p_weights);
  END IF;
  v_valid := public._rank_validate(p_points_earned, p_points_possible, p_category, p_period_id, p_student_id, v_warnings);
  IF NOT (v_valid->>'valid')::boolean THEN
    RETURN jsonb_build_object('valid', false, 'warnings', v_valid->'warnings', 'preview', null, 'confirmed', null);
  END IF;

  IF p_auto_confirm THEN
    RETURN jsonb_build_object(
      'valid', true, 'warnings', v_valid->'warnings',
      'preview', public.preview_rank_update(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, p_weights),
      'confirmed', public.confirm_and_apply_score_entry(
        p_student_id, p_period_id, p_category, p_points_earned, p_points_possible,
        public._rank_token(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, v_cfg),
        p_source_grade_id, p_weights));
  END IF;

  RETURN jsonb_build_object(
    'valid', true, 'warnings', v_valid->'warnings',
    'preview', public.preview_rank_update(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible, p_weights),
    'confirmed', null);
END $$;

-- 4b) Revert honors each entry's stored weights (course weights differ from
-- the school default). Replays every later entry with ITS OWN weights.
CREATE OR REPLACE FUNCTION public.revert_grade_rank_feed(p_grade_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_entry rank_period_entries%ROWTYPE;
  v_student UUID;
  v_rank TEXT; v_bar DOUBLE PRECISION; v_ex INT; v_peak TEXT;
  v_cfg JSONB;
  v_j RECORD;
  v_weights JSONB;
  v_pct_q DOUBLE PRECISION; v_pct_e DOUBLE PRECISION;
  v_pct_a DOUBLE PRECISION; v_pct_p DOUBLE PRECISION;
  v_tot_q_earned DOUBLE PRECISION; v_tot_q_possible DOUBLE PRECISION;
  v_tot_e_earned DOUBLE PRECISION; v_tot_e_possible DOUBLE PRECISION;
  v_tot_a_earned DOUBLE PRECISION; v_tot_a_possible DOUBLE PRECISION;
  v_tot_p_earned DOUBLE PRECISION; v_tot_p_possible DOUBLE PRECISION;
  v_s DOUBLE PRECISION;
  v_weighted DOUBLE PRECISION; v_weight_total DOUBLE PRECISION;
  v_adjusted DOUBLE PRECISION; v_capped DOUBLE PRECISION;
  v_fill DOUBLE PRECISION; v_n DOUBLE PRECISION;
  v_update JSONB;
  v_new_peak TEXT;
  v_rank_before TEXT;
  v_event TEXT;
BEGIN
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_role NOT IN ('admin', 'teacher') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_entry FROM rank_period_entries WHERE source_grade_id = p_grade_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('reverted', false, 'reason', 'no feed found for this grade');
  END IF;
  IF v_entry.school_id IS DISTINCT FROM v_school THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;
  v_student := v_entry.student_id;
  v_rank_before := v_entry.rank_before;

  DELETE FROM rank_period_entries WHERE id = v_entry.id;

  v_rank := COALESCE(v_entry.rank_before, 'C');
  v_bar := COALESCE(v_entry.bar_before, 0);
  v_ex := COALESCE(v_entry.ex_score_before, 0);
  v_peak := COALESCE(v_entry.peak_before, v_rank);

  v_cfg := public.get_rank_config(v_school);

  FOR v_j IN
    SELECT id, period_id, category, points_earned, points_possible, weights, created_at
    FROM rank_period_entries
    WHERE student_id = v_student
      AND (created_at, id) > (v_entry.created_at, v_entry.id)
    ORDER BY created_at, id
  LOOP
    -- Per-entry weights (as stored fractions) or the school default.
    v_weights := COALESCE(v_j.weights, v_cfg->'weights');

    SELECT
      COALESCE(SUM(points_earned) FILTER (WHERE category='quiz'), 0),
      COALESCE(SUM(points_possible) FILTER (WHERE category='quiz'), 0),
      COALESCE(SUM(points_earned) FILTER (WHERE category='exam'), 0),
      COALESCE(SUM(points_possible) FILTER (WHERE category='exam'), 0),
      COALESCE(SUM(points_earned) FILTER (WHERE category='activity'), 0),
      COALESCE(SUM(points_possible) FILTER (WHERE category='activity'), 0),
      COALESCE(SUM(points_earned) FILTER (WHERE category='participation'), 0),
      COALESCE(SUM(points_possible) FILTER (WHERE category='participation'), 0)
    INTO v_tot_q_earned, v_tot_q_possible, v_tot_e_earned, v_tot_e_possible,
         v_tot_a_earned, v_tot_a_possible, v_tot_p_earned, v_tot_p_possible
    FROM rank_period_entries
    WHERE student_id = v_student AND period_id = v_j.period_id
      AND (created_at, id) <= (v_j.created_at, v_j.id);

    v_pct_q := CASE WHEN v_tot_q_possible > 0 THEN v_tot_q_earned / v_tot_q_possible * 100 END;
    v_pct_e := CASE WHEN v_tot_e_possible > 0 THEN v_tot_e_earned / v_tot_e_possible * 100 END;
    v_pct_a := CASE WHEN v_tot_a_possible > 0 THEN v_tot_a_earned / v_tot_a_possible * 100 END;
    v_pct_p := CASE WHEN v_tot_p_possible > 0 THEN v_tot_p_earned / v_tot_p_possible * 100 END;

    v_weighted := 0; v_weight_total := 0;
    IF v_pct_q IS NOT NULL THEN
      v_weighted := v_weighted + (v_weights->>'quiz')::DOUBLE PRECISION * v_pct_q;
      v_weight_total := v_weight_total + (v_weights->>'quiz')::DOUBLE PRECISION;
    END IF;
    IF v_pct_e IS NOT NULL THEN
      v_weighted := v_weighted + (v_weights->>'exam')::DOUBLE PRECISION * v_pct_e;
      v_weight_total := v_weight_total + (v_weights->>'exam')::DOUBLE PRECISION;
    END IF;
    IF v_pct_a IS NOT NULL THEN
      v_weighted := v_weighted + (v_weights->>'activity')::DOUBLE PRECISION * v_pct_a;
      v_weight_total := v_weight_total + (v_weights->>'activity')::DOUBLE PRECISION;
    END IF;
    IF v_pct_p IS NOT NULL THEN
      v_weighted := v_weighted + (v_weights->>'participation')::DOUBLE PRECISION * v_pct_p;
      v_weight_total := v_weight_total + (v_weights->>'participation')::DOUBLE PRECISION;
    END IF;
    v_s := CASE WHEN v_weight_total > 0 THEN v_weighted / v_weight_total END;

    IF v_s IS NULL THEN
      CONTINUE;
    END IF;

    v_adjusted := 100 * power(v_s / 100.0, (v_cfg->>'k')::DOUBLE PRECISION);
    v_capped := LEAST(v_adjusted, 100);

    IF v_rank = 'EX' THEN
      IF v_adjusted >= 50 THEN
        v_ex := v_ex + (v_cfg->>'ex_step')::INT;
      ELSE
        v_ex := GREATEST(0, v_ex - (v_cfg->>'ex_step')::INT);
      END IF;
    ELSE
      v_n := COALESCE((SELECT (t->>'n')::DOUBLE PRECISION FROM jsonb_array_elements(v_cfg->'tiers') t
                       WHERE t->>'rank' = v_rank LIMIT 1), 1);
      v_fill := ((v_capped - 50) / 50.0) * (100.0 / v_n);
      v_update := public._rank_apply_update(v_rank, v_bar, v_fill, v_cfg->'tiers');
      v_rank := v_update->>'new_rank';
      v_bar := (v_update->>'new_bar')::DOUBLE PRECISION;
      IF (v_update->>'promoted')::boolean AND public._rank_order(v_rank) > public._rank_order(v_peak) THEN
        v_peak := v_rank;
      END IF;
      IF v_rank = 'EX' THEN
        v_ex := 0;
      END IF;
    END IF;
  END LOOP;

  UPDATE student_rank_state
  SET current_rank = v_rank, current_bar = v_bar, ex_score = v_ex,
      peak_rank_this_season = v_peak, updated_at = now()
  WHERE student_id = v_student;

  v_event := 'feed_reverted';
  INSERT INTO rank_history_log (school_id, student_id, period_id, category, points_earned, points_possible,
    event_type, rank_before, rank_after, bar_before, bar_after, ex_score_before, ex_score_after)
  VALUES (v_school, v_student, v_entry.period_id, v_entry.category, v_entry.points_earned, v_entry.points_possible,
    v_event, v_rank_before, v_rank, v_entry.bar_before, v_bar, v_entry.ex_score_before, v_ex);

  RETURN jsonb_build_object(
    'reverted', true,
    'grade_id', p_grade_id,
    'removed', jsonb_build_object(
      'category', v_entry.category, 'points_earned', v_entry.points_earned,
      'points_possible', v_entry.points_possible, 'period_id', v_entry.period_id),
    'state', jsonb_build_object(
      'current_rank', v_rank, 'current_bar', v_bar, 'ex_score', v_ex,
      'peak_rank_this_season', v_peak));
END $$;

-- 5) RPCs for course weights + semesters --------------------------------------

-- Save a course's category weights (percentages summing to 100). The course's
-- teacher or any admin of the school may set them.
CREATE OR REPLACE FUNCTION public.save_course_rank_weights(p_course_id UUID, p_weights JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID; v_course_school UUID;
  v_sum DOUBLE PRECISION;
BEGIN
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id INTO v_course_school FROM courses WHERE id = p_course_id;
  IF v_course_school IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- The course's teacher or an admin of the course's school.
  IF v_role <> 'admin' AND NOT EXISTS (
    SELECT 1 FROM courses WHERE id = p_course_id AND teacher_id = v_me
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF v_school IS DISTINCT FROM v_course_school THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;

  -- Weights must cover all four categories, be non-negative, sum to 100.
  IF p_weights IS NULL
     OR NOT (p_weights ? 'quiz' AND p_weights ? 'exam' AND p_weights ? 'activity' AND p_weights ? 'participation') THEN
    RAISE EXCEPTION 'Weights must include quiz, exam, activity and participation';
  END IF;
  SELECT COALESCE(SUM((v)::text::DOUBLE PRECISION), 0) INTO v_sum
  FROM jsonb_each(p_weights) AS e(k, v);
  IF abs(v_sum - 100) > 0.01 THEN
    RAISE EXCEPTION 'Weights must sum to 100 (got %)', round(v_sum::numeric, 2);
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_weights) AS e(k, v) WHERE (v)::text::DOUBLE PRECISION < 0) THEN
    RAISE EXCEPTION 'Weights cannot be negative';
  END IF;

  INSERT INTO course_rank_weights (course_id, school_id, weights, updated_at)
  VALUES (p_course_id, v_course_school, p_weights, now())
  ON CONFLICT (course_id) DO UPDATE SET weights = EXCLUDED.weights, updated_at = now();

  RETURN jsonb_build_object('course_id', p_course_id, 'weights', p_weights);
END $$;

-- Get a course's weights (its own config, or the school default as percents).
CREATE OR REPLACE FUNCTION public.get_course_rank_weights(p_course_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school UUID;
  v_weights JSONB;
  v_cfg JSONB;
BEGIN
  SELECT school_id INTO v_school FROM courses WHERE id = p_course_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = v_school) THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;

  SELECT weights INTO v_weights FROM course_rank_weights WHERE course_id = p_course_id;
  IF NOT FOUND THEN
    v_cfg := public.get_rank_config(v_school);
    v_weights := jsonb_build_object(
      'quiz', round(((v_cfg->'weights'->>'quiz')::DOUBLE PRECISION * 100)::numeric, 1),
      'exam', round(((v_cfg->'weights'->>'exam')::DOUBLE PRECISION * 100)::numeric, 1),
      'activity', round(((v_cfg->'weights'->>'activity')::DOUBLE PRECISION * 100)::numeric, 1),
      'participation', round(((v_cfg->'weights'->>'participation')::DOUBLE PRECISION * 100)::numeric, 1));
  END IF;
  RETURN v_weights;
END $$;

-- Admin declares a new semester; any previously active semester is closed.
CREATE OR REPLACE FUNCTION public.declare_semester(
  p_school_id UUID, p_school_year TEXT, p_semester_label TEXT,
  p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_row school_semesters%ROWTYPE;
BEGIN
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_role <> 'admin' OR v_school IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'Only admins of this school can declare a semester';
  END IF;
  IF p_school_year IS NULL OR trim(p_school_year) = '' OR p_semester_label IS NULL OR trim(p_semester_label) = '' THEN
    RAISE EXCEPTION 'school_year and semester_label are required';
  END IF;

  UPDATE school_semesters SET status = 'ended'
  WHERE school_id = p_school_id AND status = 'active';

  INSERT INTO school_semesters (school_id, school_year, semester_label, start_date, end_date)
  VALUES (p_school_id, p_school_year, p_semester_label, p_start_date, p_end_date)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id, 'school_id', v_row.school_id, 'school_year', v_row.school_year,
    'semester_label', v_row.semester_label, 'start_date', v_row.start_date,
    'end_date', v_row.end_date, 'status', v_row.status);
END $$;

-- Active semester for a school, if any.
CREATE OR REPLACE FUNCTION public.get_active_semester(p_school_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row school_semesters%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = p_school_id) THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;
  SELECT * INTO v_row FROM school_semesters
  WHERE school_id = p_school_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_row.id, 'school_year', v_row.school_year, 'semester_label', v_row.semester_label,
    'start_date', v_row.start_date, 'end_date', v_row.end_date, 'status', v_row.status);
END $$;

-- 6) Feed trigger: max_score, course weights, semester period -----------------

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
