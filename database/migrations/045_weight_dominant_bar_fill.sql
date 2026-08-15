-- ===========================================================================
-- 045_weight_dominant_bar_fill.sql
-- Makes the category WEIGHT control the rank bar, not the cumulative average.
--
-- User report: "a perfect Quiz moved the bar ~as much as a perfect Exam even
-- though the Exam weight is 40 and the Quiz is 15". Root cause: the fill was
-- computed from the composite (weighted average of category percentages):
--   fill = ((adjusted_capped - 50) / 50) * (100 / n)
-- so a grade that lands on an already-strong average got a big fill regardless
-- of its own category weight.
--
-- New rule (mirrors lib/rankEngine.ts computeFillChange + previewRankUpdate):
--   entryPct    = (points_earned / points_possible) * 100
--   weightShare = weight[category] / sum(weight of ACTIVE categories)
--   fill        = ((entryPct - 50) / 50) * (100 / n) * weightShare
-- A perfect Exam (weight 40) now moves the bar 40/15 = 2.67x a perfect Quiz
-- (weight 15), exactly as the teacher's config says.
--
--   1. preview_rank_update - single 6-arg overload (p_weights DEFAULT NULL),
--      D seed, weight-dominant fill.
--   2. confirm_and_apply_score_entry - uses the preview's fill_change so
--      preview and confirm can never disagree.
--   3. revert_grade_rank_feed - category-agnostic replay now uses the same
--      weight-dominant fill per entry (entry category from the stored row).
--   4. Replay: every existing student state is recomputed from the D seed
--      through its period entries with the new fill, so live bars reflect the
--      new rule.
--
-- Idempotent: DROP FUNCTION IF EXISTS + CREATE OR REPLACE + guarded DO.
-- ===========================================================================

-- 1) preview_rank_update ------------------------------------------------------
-- Drop BOTH legacy overloads, then recreate a single 6-arg signature with
-- p_weights DEFAULT NULL (5-arg call sites keep working).
DROP FUNCTION IF EXISTS public.preview_rank_update(uuid, text, text, int, int);
DROP FUNCTION IF EXISTS public.preview_rank_update(uuid, text, text, int, int, jsonb);

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
  v_entry_pct DOUBLE PRECISION;
  v_weight_share DOUBLE PRECISION;
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

  -- Weight-dominant fill: the entry's OWN quality scaled by its category's
  -- weight share over the ACTIVE categories (the keys of v_pcts). A perfect
  -- Exam (weight 40) moves the bar 40/15 = 2.67x a perfect Quiz (weight 15).
  -- Capped at 100 like the old adjusted_capped - bonus credit never over-fills.
  v_entry_pct := LEAST((p_points_earned::DOUBLE PRECISION / p_points_possible) * 100.0, 100.0);
  SELECT COALESCE((v_cfg->'weights'->>p_category)::DOUBLE PRECISION, 0)
         / NULLIF(SUM(COALESCE((v_cfg->'weights'->>k)::DOUBLE PRECISION, 0)), 0)
  INTO v_weight_share
  FROM jsonb_object_keys(v_pcts) k;
  v_fill := ((v_entry_pct - 50) / 50.0) * (100.0 / v_n) * COALESCE(v_weight_share, 0);
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

-- 2) confirm_and_apply_score_entry --------------------------------------------
-- Same signature as migration 043 (period-adopt) but the fill now comes from
-- the preview's weight-dominant computation, so confirm always agrees.
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
  v_fill DOUBLE PRECISION;
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
    -- The bar moves by the preview's weight-dominant fill - the teacher's
    -- category weights control it (perfect Exam at weight 40 > perfect Quiz
    -- at weight 15), and confirm can never disagree with the preview.
    v_fill := COALESCE((v_preview->>'fill_change')::DOUBLE PRECISION, 0);
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

-- 3) revert_grade_rank_feed ----------------------------------------------------
-- Category-agnostic replay (migrations 040/041) with the weight-dominant fill.
DROP FUNCTION IF EXISTS public.revert_grade_rank_feed(uuid);
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
  v_entry_pct DOUBLE PRECISION;
  v_weight_share DOUBLE PRECISION;
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
    SELECT id, period_id, category, points_earned, points_possible, weights, created_at
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
      -- Weight-dominant fill per entry (mirrors preview_rank_update).
      -- Capped at 100 - bonus credit never over-fills.
      v_entry_pct := LEAST((v_j.points_earned::DOUBLE PRECISION / v_j.points_possible) * 100.0, 100.0);
      SELECT COALESCE((v_weights->>v_j.category)::DOUBLE PRECISION, 0)
             / NULLIF(SUM(COALESCE((v_weights->>k)::DOUBLE PRECISION, 0)), 0)
      INTO v_weight_share
      FROM jsonb_object_keys(v_pcts) k;
      v_fill := ((v_entry_pct - 50) / 50.0) * (100.0 / v_n) * COALESCE(v_weight_share, 0);
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

-- 4) Replay existing rows with the new weight-dominant fill --------------------
-- Every existing state is recomputed from D/0 through its period entries using
-- the new fill, so live bars immediately reflect the weight config. Per-entry
-- stored weights (course categories) are honored. highest_rank_ever is an
-- all-time high-water mark and is left untouched; the untouched D seed stays.
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
  v_entry_pct DOUBLE PRECISION;
  v_weight_share DOUBLE PRECISION;
  v_fill DOUBLE PRECISION; v_n DOUBLE PRECISION;
  v_update JSONB;
BEGIN
  FOR v_school, v_student IN
    SELECT DISTINCT s.school_id, s.student_id
    FROM student_rank_state s
  LOOP
    SELECT count(*) INTO v_entries FROM rank_period_entries WHERE student_id = v_student;
    IF v_entries = 0 THEN
      -- Never graded: keep the D seed (never-ranked students stay D).
      CONTINUE;
    END IF;

    v_rank := 'D'; v_bar := 0; v_ex := 0; v_peak := 'D';
    v_cfg := public.get_rank_config(v_school);

    FOR v_j IN
      SELECT id, period_id, category, points_earned, points_possible, weights, created_at
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
        -- Weight-dominant fill per entry (mirrors preview_rank_update).
        -- Capped at 100 - bonus credit never over-fills.
      v_entry_pct := LEAST((v_j.points_earned::DOUBLE PRECISION / v_j.points_possible) * 100.0, 100.0);
        SELECT COALESCE((v_weights->>v_j.category)::DOUBLE PRECISION, 0)
               / NULLIF(SUM(COALESCE((v_weights->>k)::DOUBLE PRECISION, 0)), 0)
        INTO v_weight_share
        FROM jsonb_object_keys(v_pcts) k;
        v_fill := ((v_entry_pct - 50) / 50.0) * (100.0 / v_n) * COALESCE(v_weight_share, 0);
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
