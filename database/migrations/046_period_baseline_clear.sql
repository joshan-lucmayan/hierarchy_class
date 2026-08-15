-- ===========================================================================
-- 046_period_baseline_clear.sql
-- Fixes "after clearing the data I still have ~7 bar remaining".
--
-- Root cause: admin "Clear all course data" bulk-deletes every grade_entries
-- row at once. The AFTER DELETE trigger fires revert_grade_rank_feed per row
-- in arbitrary order. Each revert anchored on the DELETED entry's stored
-- before-state (rank_before/bar_before) and replayed only LATER entries - that
-- is only correct for newest-first single deletes. In a bulk clear, when an
-- entry's predecessors are already deleted, its anchor still contains their
-- effects, so the chain never collapses to the period baseline. The state ends
-- at a stale mid-chain value (e.g. D / 6.905) instead of D / 0.
--
--   1. student_rank_state gains a period-start baseline snapshot
--      (period_start_rank/bar/ex_score/peak) - captured whenever the grading
--      period is adopted (confirm's period-adopt block and
--      reset_period_category_totals), and defaulting to D/0 for fresh rows.
--   2. revert_grade_rank_feed: deleting an entry in the CURRENT period now
--      recomputes order-independently - reset to the period baseline, then
--      replay ALL remaining entries of the current period (weight-dominant
--      fill, per-entry stored weights). Deleting an entry from an OLDER period
--      keeps the previous anchor + replay-later behavior (best effort, since
--      old-period effects are baked into the baseline).
--   3. Backfill + replay: existing rows get their baseline from the earliest
--      surviving entry of their current period (falling back to D/0 when no
--      entries remain), then every student's state is recomputed from that
--      baseline through their current-period entries - which also clears any
--      residue left by the bug (the current live D/6.905 row returns to D/0).
--
-- Idempotent: ALTER ... ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE + DO.
-- ===========================================================================

-- 1) Baseline columns ---------------------------------------------------------
ALTER TABLE student_rank_state
  ADD COLUMN IF NOT EXISTS period_start_rank TEXT NOT NULL DEFAULT 'D',
  ADD COLUMN IF NOT EXISTS period_start_bar DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS period_start_ex_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS period_start_peak TEXT NOT NULL DEFAULT 'D';

-- 2) Backfill baselines from the earliest surviving entry of the current
--    period (its before-state IS the state the period started from). Students
--    with no entries keep the D/0 default - which is exactly the clean state.
UPDATE student_rank_state s
SET period_start_rank = e.rank_before,
    period_start_bar = e.bar_before,
    period_start_ex_score = e.ex_score_before,
    period_start_peak = e.peak_before
FROM (
  SELECT DISTINCT ON (student_id) student_id,
         rank_before, bar_before, ex_score_before, peak_before
  FROM rank_period_entries e
  WHERE period_id = (SELECT period_id FROM student_rank_state s2 WHERE s2.student_id = e.student_id)
  ORDER BY student_id, created_at, id
) e
WHERE s.student_id = e.student_id;

-- 3) confirm_and_apply_score_entry: capture the baseline when the period is
--    adopted (the carried rank/bar/ex/peak BEFORE the first new-period entry).
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
  -- period's entries form the fresh composite, and the carried state becomes
  -- the period-start baseline (period_start_*) that reverts recompute from.
  IF v_state.period_id IS NULL OR v_state.period_id IS DISTINCT FROM p_period_id THEN
    UPDATE student_rank_state
    SET period_id = p_period_id,
        period_start_rank = v_state.current_rank,
        period_start_bar = v_state.current_bar,
        period_start_ex_score = v_state.ex_score,
        period_start_peak = v_state.peak_rank_this_season,
        updated_at = now()
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

-- 4) reset_period_category_totals: also capture the baseline for the new period.
CREATE OR REPLACE FUNCTION public.reset_period_category_totals(
  p_student_id UUID, p_new_period_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_state student_rank_state%ROWTYPE;
  v_cleared INT;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, true);
  v_state := public._rank_ensure_state(p_student_id);

  DELETE FROM rank_period_entries
  WHERE student_id = p_student_id AND period_id IS DISTINCT FROM p_new_period_id;
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  UPDATE student_rank_state
  SET period_id = p_new_period_id,
      period_start_rank = v_state.current_rank,
      period_start_bar = v_state.current_bar,
      period_start_ex_score = v_state.ex_score,
      period_start_peak = v_state.peak_rank_this_season,
      updated_at = now()
  WHERE student_id = p_student_id;

  INSERT INTO rank_history_log (school_id, student_id, period_id, event_type)
  VALUES (v_school, p_student_id, p_new_period_id, 'period_reset');

  v_state := public._rank_ensure_state(p_student_id);
  RETURN jsonb_build_object('period_id', p_new_period_id, 'cleared_entries', v_cleared, 'state', jsonb_build_object(
    'current_rank', v_state.current_rank, 'current_bar', v_state.current_bar, 'ex_score', v_state.ex_score,
    'peak_rank_this_season', v_state.peak_rank_this_season, 'highest_rank_ever', v_state.highest_rank_ever,
    'highest_rank_season', v_state.highest_rank_season, 'period_id', v_state.period_id));
END $$;

-- 5) revert_grade_rank_feed: order-independent recompute for current-period
--    deletions; old-period deletions keep the anchor + replay-later path.
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

  SELECT period_id INTO v_cur_period FROM student_rank_state WHERE student_id = v_student;

  DELETE FROM rank_period_entries WHERE id = v_entry.id;

  v_cfg := public.get_rank_config(v_school);

  IF v_entry.period_id = v_cur_period THEN
    -- CURRENT-period deletion: order-independent recompute. Reset to the
    -- period-start baseline and replay ALL remaining entries of the current
    -- period - so clearing every grade lands exactly on the baseline (D/0 for
    -- a fresh student), no matter the order the bulk delete fired in.
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
        -- Weight-dominant fill per entry (mirrors preview_rank_update).
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
        -- Weight-dominant fill per entry (mirrors preview_rank_update).
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

-- 6) Replay every student from their period baseline through all remaining
--    current-period entries (same weight-dominant math). This clears any
--    residue the bug left behind AND makes the stored state exactly equal to
--    what a fresh recompute would produce. highest_rank_ever is untouched.
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
  v_entry_pct DOUBLE PRECISION;
  v_weight_share DOUBLE PRECISION;
  v_fill DOUBLE PRECISION; v_n DOUBLE PRECISION;
  v_update JSONB;
BEGIN
  FOR v_school, v_student IN
    SELECT DISTINCT s.school_id, s.student_id
    FROM student_rank_state s
  LOOP
    SELECT period_id INTO v_cur_period FROM student_rank_state WHERE student_id = v_student;

    -- Start from the period baseline (D/0 default for a never-graded student).
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
        -- Weight-dominant fill per entry (mirrors preview_rank_update).
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
