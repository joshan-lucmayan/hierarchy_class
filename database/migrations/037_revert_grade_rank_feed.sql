-- ===========================================================================
-- 037_revert_grade_rank_feed.sql
-- Reverses the auto-feed from migration 036 when an approved grade is later
-- rejected (or deleted). Deleting a rank_period_entries row alone is NOT
-- enough - the student's rank/bar evolve through every entry, so we restore
-- the state captured before that entry was applied and then REPLAY every
-- later entry through the exact same engine math (composite -> adjusted ->
-- fill -> apply), so the final rank/bar is exactly what it would have been
-- had the grade never existed.
--
-- What this migration does:
--   1. rank_period_entries.source_grade_id  - links each period entry to the
--      grade_entries row that fed it (plain column, no FK: grade rows can be
--      deleted and the AFTER DELETE trigger needs OLD.id to find its feed).
--   2. rank_period_entries.rank_before / bar_before / ex_score_before /
--      peak_before - the student_rank_state values at the moment the entry
--      was applied (written by confirm_and_apply_score_entry).
--   3. confirm_and_apply_score_entry + process_score_entry accept an optional
--      p_source_grade_id (last param, defaulted) and record the before-state.
--   4. revert_grade_rank_feed(p_grade_id) - SECURITY DEFINER: finds the feed,
--      deletes it, restores the before-state, replays later entries, updates
--      student_rank_state, and logs event_type 'feed_reverted'.
--   5. feed_approved_grade_to_rank now also handles REJECTION (undo + clear
--      rank_fed_at so a later re-approval feeds again) and passes the grade id
--      through to the feed. A new AFTER DELETE trigger reverts deleted
--      approved grades too (no-op for never-fed rows).
--
-- Idempotent: DROP ... IF EXISTS before CREATE, ADD COLUMN IF NOT EXISTS.
-- ===========================================================================

-- 1) Link + before-state on the period entries ---------------------------------
ALTER TABLE rank_period_entries
  ADD COLUMN IF NOT EXISTS source_grade_id UUID,
  ADD COLUMN IF NOT EXISTS rank_before TEXT,
  ADD COLUMN IF NOT EXISTS bar_before DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ex_score_before INT,
  ADD COLUMN IF NOT EXISTS peak_before TEXT;

CREATE INDEX IF NOT EXISTS idx_rank_entries_source_grade
  ON rank_period_entries(source_grade_id);

-- 2) Thread p_source_grade_id through the writers and record before-state ----
-- (Signature changes: drop the old overloads first, then re-create.)

DROP FUNCTION IF EXISTS public.confirm_and_apply_score_entry(uuid, text, text, int, int, text);
CREATE OR REPLACE FUNCTION public.confirm_and_apply_score_entry(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_preview_token TEXT,
  p_source_grade_id UUID DEFAULT NULL)
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

  v_preview := public.preview_rank_update(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible);
  v_bar_before := v_state.current_bar;
  v_ex_before := v_state.ex_score;

  INSERT INTO rank_period_entries (school_id, student_id, period_id, category, points_earned, points_possible,
    source_grade_id, rank_before, bar_before, ex_score_before, peak_before)
  VALUES (v_school, p_student_id, p_period_id, p_category, p_points_earned, p_points_possible,
    p_source_grade_id, v_rank_before, v_bar_before, v_ex_before, v_peak_before);

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

DROP FUNCTION IF EXISTS public.process_score_entry(uuid, text, text, int, int, boolean);
CREATE OR REPLACE FUNCTION public.process_score_entry(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_auto_confirm BOOLEAN DEFAULT false,
  p_source_grade_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_valid JSONB;
  v_me UUID; v_role TEXT; v_school UUID;
  v_warnings JSONB := '[]'::jsonb;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, true);
  v_valid := public._rank_validate(p_points_earned, p_points_possible, p_category, p_period_id, p_student_id, v_warnings);
  IF NOT (v_valid->>'valid')::boolean THEN
    RETURN jsonb_build_object('valid', false, 'warnings', v_valid->'warnings', 'preview', null, 'confirmed', null);
  END IF;

  IF p_auto_confirm THEN
    RETURN jsonb_build_object(
      'valid', true, 'warnings', v_valid->'warnings',
      'preview', public.preview_rank_update(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible),
      'confirmed', public.confirm_and_apply_score_entry(
        p_student_id, p_period_id, p_category, p_points_earned, p_points_possible,
        public._rank_token(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible,
                           public.get_rank_config(v_school)),
        p_source_grade_id));
  END IF;

  RETURN jsonb_build_object(
    'valid', true, 'warnings', v_valid->'warnings',
    'preview', public.preview_rank_update(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible),
    'confirmed', null);
END $$;

-- 3) The revert RPC ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revert_grade_rank_feed(p_grade_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_entry rank_period_entries%ROWTYPE;
  v_student UUID;
  v_rank TEXT; v_bar DOUBLE PRECISION; v_ex INT; v_peak TEXT;
  v_cfg JSONB;
  v_j RECORD;
  v_tot_q_earned DOUBLE PRECISION; v_tot_q_possible DOUBLE PRECISION;
  v_tot_e_earned DOUBLE PRECISION; v_tot_e_possible DOUBLE PRECISION;
  v_tot_a_earned DOUBLE PRECISION; v_tot_a_possible DOUBLE PRECISION;
  v_tot_p_earned DOUBLE PRECISION; v_tot_p_possible DOUBLE PRECISION;
  v_pct_q DOUBLE PRECISION; v_pct_e DOUBLE PRECISION;
  v_pct_a DOUBLE PRECISION; v_pct_p DOUBLE PRECISION;
  v_s DOUBLE PRECISION;
  v_weighted DOUBLE PRECISION; v_weight_total DOUBLE PRECISION;
  v_adjusted DOUBLE PRECISION; v_capped DOUBLE PRECISION;
  v_fill DOUBLE PRECISION; v_n DOUBLE PRECISION;
  v_update JSONB;
  v_new_peak TEXT;
  v_rank_before TEXT;
  v_event TEXT;
BEGIN
  -- Auth: admin or teacher (same write scope as the feed).
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_role NOT IN ('admin', 'teacher') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Find the feed this grade produced (if any). Scope is checked against the
  -- feed entry's OWN school_id - this also works from the AFTER DELETE trigger,
  -- where the grade row no longer exists to look its school up from.
  SELECT * INTO v_entry FROM rank_period_entries WHERE source_grade_id = p_grade_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('reverted', false, 'reason', 'no feed found for this grade');
  END IF;
  IF v_entry.school_id IS DISTINCT FROM v_school THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;
  v_student := v_entry.student_id;
  v_rank_before := v_entry.rank_before;

  -- Delete the entry, then restore the before-state.
  DELETE FROM rank_period_entries WHERE id = v_entry.id;

  v_rank := COALESCE(v_entry.rank_before, 'C');
  v_bar := COALESCE(v_entry.bar_before, 0);
  v_ex := COALESCE(v_entry.ex_score_before, 0);
  v_peak := COALESCE(v_entry.peak_before, v_rank);

  v_cfg := public.get_rank_config(v_school);

  -- Replay every LATER entry (created_at, id) > the removed one through the
  -- exact confirm math. The deleted entry is already gone, so category totals
  -- naturally exclude it; the before-state anchors rank/bar/ex/peak.
  FOR v_j IN
    SELECT id, period_id, category, points_earned, points_possible, created_at
    FROM rank_period_entries
    WHERE student_id = v_student
      AND (created_at, id) > (v_entry.created_at, v_entry.id)
    ORDER BY created_at, id
  LOOP
    -- Running category totals up to and including this entry (same period).
    SELECT COALESCE(SUM(points_earned) FILTER (WHERE category='quiz'), 0),
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

    -- Composite: weighted mean of ACTIVE categories only.
    v_weighted := 0; v_weight_total := 0;
    IF v_pct_q IS NOT NULL THEN
      v_weighted := v_weighted + ((v_cfg->'weights'->>'quiz')::DOUBLE PRECISION) * v_pct_q;
      v_weight_total := v_weight_total + (v_cfg->'weights'->>'quiz')::DOUBLE PRECISION;
    END IF;
    IF v_pct_e IS NOT NULL THEN
      v_weighted := v_weighted + ((v_cfg->'weights'->>'exam')::DOUBLE PRECISION) * v_pct_e;
      v_weight_total := v_weight_total + (v_cfg->'weights'->>'exam')::DOUBLE PRECISION;
    END IF;
    IF v_pct_a IS NOT NULL THEN
      v_weighted := v_weighted + ((v_cfg->'weights'->>'activity')::DOUBLE PRECISION) * v_pct_a;
      v_weight_total := v_weight_total + (v_cfg->'weights'->>'activity')::DOUBLE PRECISION;
    END IF;
    IF v_pct_p IS NOT NULL THEN
      v_weighted := v_weighted + ((v_cfg->'weights'->>'participation')::DOUBLE PRECISION) * v_pct_p;
      v_weight_total := v_weight_total + (v_cfg->'weights'->>'participation')::DOUBLE PRECISION;
    END IF;
    v_s := CASE WHEN v_weight_total > 0 THEN v_weighted / v_weight_total END;

    -- No active categories -> this entry changes nothing.
    IF v_s IS NULL THEN
      CONTINUE;
    END IF;

    v_adjusted := 100 * power(v_s / 100.0, (v_cfg->>'k')::DOUBLE PRECISION);
    v_capped := LEAST(v_adjusted, 100);

    IF v_rank = 'EX' THEN
      -- EX: open-ended score only.
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

  -- Persist the recomputed state.
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

-- 4) Trigger: feed on approval, REVERT on rejection/deletion ------------------
-- Drop the 036 trigger first - it depends on the old function body.
DROP TRIGGER IF EXISTS trg_grade_approved_feeds_rank ON grade_entries;
DROP FUNCTION IF EXISTS public.feed_approved_grade_to_rank();
CREATE OR REPLACE FUNCTION public.feed_approved_grade_to_rank()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_category TEXT;
  v_period TEXT;
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

    SELECT period_id INTO v_period
    FROM student_rank_state WHERE student_id = NEW.student_id;
    v_period := COALESCE(v_period, 'Period 1');

    BEGIN
      v_result := public.process_score_entry(
        p_student_id      => NEW.student_id,
        p_period_id       => v_period,
        p_category        => v_category,
        p_points_earned   => NEW.score,
        p_points_possible => 100,
        p_auto_confirm    => true,
        p_source_grade_id => NEW.id
      );
      NEW.rank_fed_at := now();
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'rank feed skipped for grade %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grade_approved_feeds_rank ON grade_entries;
CREATE TRIGGER trg_grade_approved_feeds_rank
BEFORE UPDATE OF approval_status ON grade_entries
FOR EACH ROW
WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
EXECUTE FUNCTION public.feed_approved_grade_to_rank();

-- Revert when an approved (fed) grade row is deleted outright.
CREATE OR REPLACE FUNCTION public.revert_deleted_grade_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.approval_status = 'approved' AND OLD.rank_fed_at IS NOT NULL THEN
    BEGIN
      PERFORM public.revert_grade_rank_feed(OLD.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'rank revert skipped for deleted grade %: %', OLD.id, SQLERRM;
    END;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_grade_deleted_reverts_rank ON grade_entries;
CREATE TRIGGER trg_grade_deleted_reverts_rank
AFTER DELETE ON grade_entries
FOR EACH ROW
EXECUTE FUNCTION public.revert_deleted_grade_feed();
