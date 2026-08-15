-- ===========================================================================
-- 041_rank_seed_at_d.sql
-- Students now START at the bottom tier (D) with a 0 bar, instead of being
-- seeded at C. The first grade fills the D bar; promotion to C only happens
-- when the bar reaches 100% - so entering the first quiz/grade on a student
-- never jumps them straight to C.
--
--   1. student_rank_state column defaults: current_rank / peak_rank_this_season
--      / highest_rank_ever default to 'D' (were 'C').
--   2. preview_rank_update's synthetic state for students WITHOUT a row yet
--      defaults to D (was C).
--   3. revert_grade_rank_feed's replay anchor defaults to D (was C).
--   4. Existing rows are REPLAYED from a D/0 seed through their period entries
--      (same composite -> adjusted -> fill -> apply math as the revert replay,
--      honoring per-entry stored weights), so live data matches the new rule
--      instead of keeping the old C-seeded values.
--
-- Idempotent: ALTER ... SET DEFAULT, CREATE OR REPLACE FUNCTION, guarded DO.
-- ===========================================================================

-- 1) DDL defaults ------------------------------------------------------------
ALTER TABLE student_rank_state ALTER COLUMN current_rank SET DEFAULT 'D';
ALTER TABLE student_rank_state ALTER COLUMN peak_rank_this_season SET DEFAULT 'D';
ALTER TABLE student_rank_state ALTER COLUMN highest_rank_ever SET DEFAULT 'D';

-- 2) Preview synthetic state defaults -> D -----------------------------------
CREATE OR REPLACE FUNCTION public.preview_rank_update(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT)
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

-- 3) Revert replay anchor -> D ------------------------------------------------
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

  DELETE FROM rank_period_entries WHERE id = v_entry.id;

  v_rank := COALESCE(v_entry.rank_before, 'D');
  v_bar := COALESCE(v_entry.bar_before, 0);
  v_ex := COALESCE(v_entry.ex_score_before, 0);
  v_peak := COALESCE(v_entry.peak_before, v_rank);

  v_cfg := public.get_rank_config(v_school);

  FOR v_j IN
    SELECT id, period_id, points_earned, points_possible, weights, created_at
    FROM rank_period_entries
    WHERE student_id = v_student
      AND (created_at, id) > (v_entry.created_at, v_entry.id)
    ORDER BY created_at, id
  LOOP
    -- Per-entry weights (as stored fractions) or the school default.
    v_weights := COALESCE(v_j.weights, v_cfg->'weights');

    -- Category percentages over ALL categories present in the window up to and
    -- including this entry (same math as preview_rank_update).
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

    -- Composite: weighted mean of ACTIVE categories only.
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

-- 4) Replay existing rows from the D seed -------------------------------------
-- Every existing state is recomputed from D/0 through its period entries, so
-- live data follows the new "start at D, fill to 100%, then promote" rule.
-- highest_rank_ever is an all-time high-water mark and is left untouched
-- (except untouched C-seed rows with no entries, which move to D).
DO $$
DECLARE
  v_school UUID;
  v_cfg JSONB;
  v_student UUID;
  v_rank TEXT; v_bar DOUBLE PRECISION; v_ex INT; v_peak TEXT;
  v_entries INT;
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
    SELECT count(*) INTO v_entries FROM rank_period_entries WHERE student_id = v_student;
    IF v_entries = 0 THEN
      -- Never graded: the untouched seed. Reset cleanly to D (including the
      -- all-time mark - this student has never ranked above D).
      UPDATE student_rank_state
      SET current_rank = 'D', current_bar = 0, ex_score = 0,
          peak_rank_this_season = 'D', highest_rank_ever = 'D', updated_at = now()
      WHERE student_id = v_student;
      CONTINUE;
    END IF;

    v_rank := 'D'; v_bar := 0; v_ex := 0; v_peak := 'D';
    v_cfg := public.get_rank_config(v_school);

    FOR v_j IN
      SELECT id, period_id, points_earned, points_possible, weights, created_at
      FROM rank_period_entries
      WHERE student_id = v_student
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
