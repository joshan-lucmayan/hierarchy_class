-- ===========================================================================
-- 047_restore_composite_fill.sql
-- Restores the ORIGINAL rank bar math after the 045 weight-dominant experiment
-- ("the rank system gets worse - restore the old math").
--
-- 045 made the bar move by the entry's OWN percentage x its category's weight
-- share over the active categories. That proved wrong in practice. The old
-- (and now restored) rule is the composite through the power curve:
--   fill = ((Adjusted_capped - 50) / 50) * (100 / n)
-- where Adjusted = 100*(S/100)^k and S is the weighted average of the ACTIVE
-- category percentages (the weights still shape the composite - a perfect
-- Exam lifts the weighted average more than a perfect Quiz - which is where
-- the teacher's config matters).
--
--   1. preview_rank_update - composite-based fill again.
--   2. revert_grade_rank_feed - the 046 order-independent period-baseline
--      recompute is KEPT (that fixed the clear-data residue bug), only the
--      fill inside the replay returns to the composite formula.
--   3. confirm_and_apply_score_entry is untouched - it already uses the
--      preview's fill_change, so it follows automatically.
--   4. Replay every student from their period baseline with the restored
--      math, so live bars reflect the original system.
--
-- Idempotent: CREATE OR REPLACE + guarded DO.
-- ===========================================================================

-- 1) preview_rank_update: composite-based fill ---------------------------------
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
  -- against the defaults (rank D, bar 0) without creating any row.
  SELECT * INTO v_state FROM student_rank_state WHERE student_id = p_student_id;
  IF NOT FOUND THEN
    v_state.student_id := p_student_id;
    v_state.school_id := v_school;
    v_state.current_rank := 'D';
    v_state.current_bar := 0;
    v_state.ex_score := 0;
    v_state.peak_rank_this_season := 'D';
    v_state.highest_rank_ever := 'D';
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

  -- Composite-based fill (ORIGINAL math, restored by migration 047): the bar
  -- moves by the power-curved weighted average of category percentages. The
  -- weights still matter - they shape the composite itself.
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

-- 2) revert_grade_rank_feed: same order-independent recompute as 046, but the
--    fill inside the replay is the composite formula again.
DROP FUNCTION IF EXISTS public.revert_grade_rank_feed(uuid);
CREATE OR REPLACE FUNCTION public.revert_grade_rank_feed(p_grade_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_entry rank_period_entries%ROWTYPE;
  v_student UUID;
  v_rank TEXT; v_bar DOUBLE PRECISION; v_ex INT; v_peak TEXT;
  v_cfg JSONB;
  v_cur_period TEXT;
  v_j RECORD;
  v_weights JSONB;
  v_pcts JSONB;
  v_s DOUBLE PRECISION;
  v_adjusted DOUBLE PRECISION; v_capped DOUBLE PRECISION;
  v_fill DOUBLE PRECISION; v_n DOUBLE PRECISION;
  v_update JSONB;
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

  SELECT period_id INTO v_cur_period FROM student_rank_state WHERE student_id = v_student;

  DELETE FROM rank_period_entries WHERE id = v_entry.id;

  v_cfg := public.get_rank_config(v_school);

  IF v_entry.period_id = v_cur_period THEN
    -- CURRENT-period deletion: order-independent recompute from the period
    -- baseline (migration 046) - clearing every grade lands on the baseline.
    SELECT COALESCE(period_start_rank, 'D'), COALESCE(period_start_bar, 0),
           COALESCE(period_start_ex_score, 0), COALESCE(period_start_peak, 'D')
    INTO v_rank, v_bar, v_ex, v_peak
    FROM student_rank_state WHERE student_id = v_student;

    FOR v_j IN
      SELECT id, period_id, category, points_earned, points_possible, weights, created_at
      FROM rank_period_entries
      WHERE student_id = v_student AND period_id = v_cur_period
      ORDER BY created_at, id
    LOOP
      v_weights := COALESCE(v_j.weights, v_cfg->'weights');

      SELECT COALESCE(jsonb_object_agg(cat, pct), '{}'::jsonb) INTO v_pcts
      FROM (
        SELECT e.category AS cat,
               (COALESCE(SUM(r.points_earned), 0))::DOUBLE PRECISION
               / NULLIF(COALESCE(SUM(r.points_possible), 0), 0) * 100 AS pct
        FROM (SELECT DISTINCT category FROM rank_period_entries
              WHERE student_id = v_student AND period_id = v_j.period_id
                AND (created_at, id) <= (v_j.created_at, v_j.id)) e
        LEFT JOIN rank_period_entries r
          ON r.student_id = v_student AND r.period_id = v_j.period_id AND r.category = e.category
         AND (r.created_at, r.id) <= (v_j.created_at, v_j.id)
        GROUP BY e.category
      ) t WHERE pct IS NOT NULL;

      SELECT COALESCE(SUM((w.val)::DOUBLE PRECISION * (p.val)::DOUBLE PRECISION)
                      / NULLIF(SUM((w.val)::DOUBLE PRECISION), 0), NULL)
      INTO v_s
      FROM jsonb_each_text(v_pcts) p(cat, val)
      JOIN jsonb_each_text(v_weights) w(wcat, val) ON w.wcat = p.cat;

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
        -- Composite-based fill (restored by migration 047).
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
  ELSE
    -- OLD-period deletion: the effect is baked into the current baseline, so
    -- fall back to the anchor + replay-later behavior (best effort).
    v_rank := COALESCE(v_entry.rank_before, 'D');
    v_bar := COALESCE(v_entry.bar_before, 0);
    v_ex := COALESCE(v_entry.ex_score_before, 0);
    v_peak := COALESCE(v_entry.peak_before, v_rank);

    FOR v_j IN
      SELECT id, period_id, category, points_earned, points_possible, weights, created_at
      FROM rank_period_entries
      WHERE student_id = v_student
        AND (created_at, id) > (v_entry.created_at, v_entry.id)
      ORDER BY created_at, id
    LOOP
      v_weights := COALESCE(v_j.weights, v_cfg->'weights');

      SELECT COALESCE(jsonb_object_agg(cat, pct), '{}'::jsonb) INTO v_pcts
      FROM (
        SELECT e.category AS cat,
               (COALESCE(SUM(r.points_earned), 0))::DOUBLE PRECISION
               / NULLIF(COALESCE(SUM(r.points_possible), 0), 0) * 100 AS pct
        FROM (SELECT DISTINCT category FROM rank_period_entries
              WHERE student_id = v_student AND period_id = v_j.period_id
                AND (created_at, id) <= (v_j.created_at, v_j.id)) e
        LEFT JOIN rank_period_entries r
          ON r.student_id = v_student AND r.period_id = v_j.period_id AND r.category = e.category
         AND (r.created_at, r.id) <= (v_j.created_at, v_j.id)
        GROUP BY e.category
      ) t WHERE pct IS NOT NULL;

      SELECT COALESCE(SUM((w.val)::DOUBLE PRECISION * (p.val)::DOUBLE PRECISION)
                      / NULLIF(SUM((w.val)::DOUBLE PRECISION), 0), NULL)
      INTO v_s
      FROM jsonb_each_text(v_pcts) p(cat, val)
      JOIN jsonb_each_text(v_weights) w(wcat, val) ON w.wcat = p.cat;

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
        -- Composite-based fill (restored by migration 047).
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
  END IF;

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

-- 3) Replay every student from their period baseline with the restored
--    composite math (keeps the 046 clear fix; changes only the fill formula).
DO $$
DECLARE
  v_school UUID;
  v_cfg JSONB;
  v_student UUID;
  v_rank TEXT; v_bar DOUBLE PRECISION; v_ex INT; v_peak TEXT;
  v_cur_period TEXT;
  v_j RECORD;
  v_weights JSONB;
  v_pcts JSONB;
  v_s DOUBLE PRECISION;
  v_adjusted DOUBLE PRECISION; v_capped DOUBLE PRECISION;
  v_fill DOUBLE PRECISION; v_n DOUBLE PRECISION;
  v_update JSONB;
BEGIN
  FOR v_school, v_student IN
    SELECT DISTINCT s.school_id, s.student_id
    FROM student_rank_state s
  LOOP
    SELECT period_id INTO v_cur_period FROM student_rank_state WHERE student_id = v_student;

    SELECT COALESCE(period_start_rank, 'D'), COALESCE(period_start_bar, 0),
           COALESCE(period_start_ex_score, 0), COALESCE(period_start_peak, 'D')
    INTO v_rank, v_bar, v_ex, v_peak
    FROM student_rank_state WHERE student_id = v_student;

    v_cfg := public.get_rank_config(v_school);

    FOR v_j IN
      SELECT id, period_id, category, points_earned, points_possible, weights, created_at
      FROM rank_period_entries
      WHERE student_id = v_student AND period_id = v_cur_period
      ORDER BY created_at, id
    LOOP
      v_weights := COALESCE(v_j.weights, v_cfg->'weights');

      SELECT COALESCE(jsonb_object_agg(cat, pct), '{}'::jsonb) INTO v_pcts
      FROM (
        SELECT e.category AS cat,
               (COALESCE(SUM(r.points_earned), 0))::DOUBLE PRECISION
               / NULLIF(COALESCE(SUM(r.points_possible), 0), 0) * 100 AS pct
        FROM (SELECT DISTINCT category FROM rank_period_entries
              WHERE student_id = v_student AND period_id = v_j.period_id
                AND (created_at, id) <= (v_j.created_at, v_j.id)) e
        LEFT JOIN rank_period_entries r
          ON r.student_id = v_student AND r.period_id = v_j.period_id AND r.category = e.category
         AND (r.created_at, r.id) <= (v_j.created_at, v_j.id)
        GROUP BY e.category
      ) t WHERE pct IS NOT NULL;

      SELECT COALESCE(SUM((w.val)::DOUBLE PRECISION * (p.val)::DOUBLE PRECISION)
                      / NULLIF(SUM((w.val)::DOUBLE PRECISION), 0), NULL)
      INTO v_s
      FROM jsonb_each_text(v_pcts) p(cat, val)
      JOIN jsonb_each_text(v_weights) w(wcat, val) ON w.wcat = p.cat;

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
        -- Composite-based fill (restored by migration 047).
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
  END LOOP;
END $$;
