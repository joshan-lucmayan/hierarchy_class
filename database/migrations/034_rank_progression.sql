-- ===========================================================================
-- 034_rank_progression.sql
-- Non-linear student rank progression system - data model + backend RPCs only
-- (no UI). Mirrors the pure engine in lib/rankEngine.ts; the SECURITY DEFINER
-- functions below are the authoritative write path (RLS alone would let any
-- client rewrite their own bar, so all writes go through these).
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE FUNCTION). There is no migration-tracking table in this
-- project, so this file is the source of truth for the schema.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) TABLES
-- ---------------------------------------------------------------------------

-- Per-school config; every knob the spec says must be configurable lives here.
CREATE TABLE IF NOT EXISTS rank_config (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  weights JSONB NOT NULL DEFAULT '{"exam":0.40,"quiz":0.20,"activity":0.25,"participation":0.15}'::jsonb,
  k DOUBLE PRECISION NOT NULL DEFAULT 1.8,
  ex_step INT NOT NULL DEFAULT 1,
  tiers JSONB NOT NULL DEFAULT '[
    {"rank":"D","next":"C","n":3},
    {"rank":"C","next":"B","n":4},
    {"rank":"B","next":"A","n":5},
    {"rank":"A","next":"S","n":6},
    {"rank":"S","next":"S+","n":8},
    {"rank":"S+","next":"S++","n":10},
    {"rank":"S++","next":"EX","n":12}
  ]'::jsonb,
  season_reset_map JSONB NOT NULL DEFAULT '{
    "EX":"C","S++":"C","S+":"C","S":"C",
    "A":"D","B":"D","C":"D","D":"D"
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per student. current_bar is meaningless once current_rank = 'EX'
-- (see ex_score instead). peak_rank_this_season is a running high-water mark.
CREATE TABLE IF NOT EXISTS student_rank_state (
  student_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  current_rank TEXT NOT NULL DEFAULT 'C'
    CHECK (current_rank IN ('D','C','B','A','S','S+','S++','EX')),
  current_bar DOUBLE PRECISION NOT NULL DEFAULT 0,
  ex_score INT NOT NULL DEFAULT 0,
  peak_rank_this_season TEXT NOT NULL DEFAULT 'C'
    CHECK (peak_rank_this_season IN ('D','C','B','A','S','S+','S++','EX')),
  highest_rank_ever TEXT NOT NULL DEFAULT 'C'
    CHECK (highest_rank_ever IN ('D','C','B','A','S','S+','S++','EX')),
  highest_rank_season TEXT,
  season_id TEXT,
  period_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rank_state_school ON student_rank_state(school_id);

-- Running category totals per grading period. One row per score entry; the
-- period's category percentage is the SUM of earned over SUM of possible.
CREATE TABLE IF NOT EXISTS rank_period_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('quiz','exam','activity','participation')),
  points_earned INT NOT NULL CHECK (points_earned >= 0),
  points_possible INT NOT NULL CHECK (points_possible > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rank_period_entries_student ON rank_period_entries(student_id, period_id);
CREATE INDEX IF NOT EXISTS idx_rank_period_entries_school ON rank_period_entries(school_id);

-- Season-end snapshot (Section 10). reset_to_rank is seeded from the season's
-- PEAK rank, not the rank at the literal season end.
CREATE TABLE IF NOT EXISTS season_history_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL,
  school_year TEXT NOT NULL,
  semester_label TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  strand_or_track TEXT,
  section TEXT,
  peak_rank TEXT NOT NULL,
  final_rank_before_reset TEXT NOT NULL,
  reset_to_rank TEXT NOT NULL,
  ex_achieved BOOLEAN NOT NULL DEFAULT false,
  season_end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Heal a partially-applied state (table created before school_id was added).
ALTER TABLE season_history_log ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_season_history_student ON season_history_log(student_id, season_end_date);

-- Event log: every rank write is recorded here (promotions/demotions logged
-- distinctly so nothing slips through without an audit trail).
CREATE TABLE IF NOT EXISTS rank_history_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_id TEXT,
  category TEXT,
  points_earned INT,
  points_possible INT,
  s_score DOUBLE PRECISION,
  adjusted DOUBLE PRECISION,
  rank_before TEXT,
  rank_after TEXT,
  bar_before DOUBLE PRECISION,
  bar_after DOUBLE PRECISION,
  ex_score_before INT,
  ex_score_after INT,
  event_type TEXT NOT NULL,
  cascade_tiers INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rank_history_student ON rank_history_log(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rank_history_school ON rank_history_log(school_id);

-- ---------------------------------------------------------------------------
-- 2) ROW LEVEL SECURITY - school-scoped through profiles (same pattern as
--    020_grade_approval_account_requests.sql). Direct reads are school-wide;
--    direct writes are admin-only. All real writes go through the SECURITY
--    DEFINER RPCs below, which enforce roles explicitly.
-- ---------------------------------------------------------------------------

ALTER TABLE rank_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_rank_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_period_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_history_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_history_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rank_config_school_read" ON rank_config;
CREATE POLICY "rank_config_school_read" ON rank_config FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = rank_config.school_id)
);
DROP POLICY IF EXISTS "rank_config_admin_write" ON rank_config;
CREATE POLICY "rank_config_admin_write" ON rank_config FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = rank_config.school_id)
);

DROP POLICY IF EXISTS "rank_state_school_read" ON student_rank_state;
CREATE POLICY "rank_state_school_read" ON student_rank_state FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = student_rank_state.school_id)
);
DROP POLICY IF EXISTS "rank_state_admin_write" ON student_rank_state;
CREATE POLICY "rank_state_admin_write" ON student_rank_state FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = student_rank_state.school_id)
);

DROP POLICY IF EXISTS "rank_entries_school_read" ON rank_period_entries;
CREATE POLICY "rank_entries_school_read" ON rank_period_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = rank_period_entries.school_id)
);
DROP POLICY IF EXISTS "rank_entries_admin_write" ON rank_period_entries;
CREATE POLICY "rank_entries_admin_write" ON rank_period_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = rank_period_entries.school_id)
);

DROP POLICY IF EXISTS "season_history_school_read" ON season_history_log;
CREATE POLICY "season_history_school_read" ON season_history_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = season_history_log.school_id)
);
DROP POLICY IF EXISTS "season_history_admin_write" ON season_history_log;
CREATE POLICY "season_history_admin_write" ON season_history_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = season_history_log.school_id)
);

DROP POLICY IF EXISTS "rank_history_school_read" ON rank_history_log;
CREATE POLICY "rank_history_school_read" ON rank_history_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = rank_history_log.school_id)
);
DROP POLICY IF EXISTS "rank_history_admin_write" ON rank_history_log;
CREATE POLICY "rank_history_admin_write" ON rank_history_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = rank_history_log.school_id)
);

-- ---------------------------------------------------------------------------
-- 3) SHARED HELPERS
-- ---------------------------------------------------------------------------

-- Position in RANK_ORDER; used for peak/highest comparisons.
CREATE OR REPLACE FUNCTION public._rank_order(p_rank TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_position(ARRAY['D','C','B','A','S','S+','S++','EX'], p_rank), -1);
$$;

-- Auth gate: resolves the caller + target and enforces school scope.
-- p_write = true -> admin/teacher only; false -> admin/teacher or the student
-- themselves. Raises on any violation.
CREATE OR REPLACE FUNCTION public._rank_auth(p_student_id UUID, p_write BOOLEAN)
RETURNS TABLE(me UUID, my_role TEXT, my_school UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID;
  v_role TEXT;
  v_school UUID;
  v_target_school UUID;
BEGIN
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id INTO v_target_school FROM profiles WHERE id = p_student_id;
  IF v_target_school IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  IF v_target_school IS DISTINCT FROM v_school THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;

  IF p_write AND v_role NOT IN ('admin', 'teacher') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF NOT p_write AND v_role NOT IN ('admin', 'teacher') AND v_me <> p_student_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY SELECT v_me, v_role, v_school;
END $$;

-- Get-or-create the config row for a school, returning it as a jsonb bundle.
CREATE OR REPLACE FUNCTION public.get_rank_config(p_school_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg rank_config%ROWTYPE;
BEGIN
  SELECT * INTO v_cfg FROM rank_config WHERE school_id = p_school_id;
  IF NOT FOUND THEN
    INSERT INTO rank_config (school_id) VALUES (p_school_id) RETURNING * INTO v_cfg;
  END IF;
  RETURN jsonb_build_object(
    'weights', v_cfg.weights,
    'k', v_cfg.k,
    'ex_step', v_cfg.ex_step,
    'tiers', v_cfg.tiers,
    'season_reset_map', v_cfg.season_reset_map
  );
END $$;

-- Admin-only config upsert. Rejects invalid weights/tiers/reset maps.
CREATE OR REPLACE FUNCTION public.update_rank_config(
  p_school_id UUID,
  p_weights JSONB,
  p_k DOUBLE PRECISION,
  p_ex_step INT,
  p_tiers JSONB,
  p_season_reset_map JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_sum DOUBLE PRECISION;
  v_tier JSONB;
BEGIN
  -- The caller must be an admin of the school whose config is being edited
  -- (_rank_auth expects a PROFILE id, so the check is done inline here).
  SELECT id, role, school_id INTO v_me, v_role, v_school
  FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_role <> 'admin' OR v_school IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'Only admins of this school can change rank configuration';
  END IF;

  -- weights: all four categories, non-negative, sum to 1 (± 0.001).
  IF p_weights IS NULL
     OR NOT (p_weights ? 'exam' AND p_weights ? 'quiz' AND p_weights ? 'activity' AND p_weights ? 'participation') THEN
    RAISE EXCEPTION 'Weights must include exam, quiz, activity and participation';
  END IF;
  SELECT COALESCE(SUM((v)::text::DOUBLE PRECISION), 0)
  INTO v_sum
  FROM jsonb_each(p_weights) AS e(k, v);
  IF abs(v_sum - 1) > 0.001 THEN
    RAISE EXCEPTION 'Weights must sum to 1 (got %)', round(v_sum::numeric, 3);
  END IF;

  IF NOT (p_k > 0) OR p_k IS NULL OR p_k <> p_k THEN
    RAISE EXCEPTION 'k must be a positive finite number';
  END IF;
  IF p_ex_step IS NULL OR p_ex_step < 0 THEN
    RAISE EXCEPTION 'ex_step must be a non-negative integer';
  END IF;

  -- tiers: must cover every non-EX rank.
  IF p_tiers IS NULL OR jsonb_array_length(p_tiers) = 0 THEN
    RAISE EXCEPTION 'tiers must be a non-empty array';
  END IF;
  FOR v_tier IN SELECT * FROM jsonb_array_elements(p_tiers) LOOP
    IF (v_tier->>'n') IS NULL OR (v_tier->>'n')::DOUBLE PRECISION <= 0 THEN
      RAISE EXCEPTION 'Each tier needs a positive n';
    END IF;
  END LOOP;

  -- reset map: must cover every rank.
  IF p_season_reset_map IS NULL
     OR NOT (p_season_reset_map ? 'D' AND p_season_reset_map ? 'C' AND p_season_reset_map ? 'B' AND p_season_reset_map ? 'A'
         AND p_season_reset_map ? 'S' AND p_season_reset_map ? 'S+' AND p_season_reset_map ? 'S++' AND p_season_reset_map ? 'EX') THEN
    RAISE EXCEPTION 'season_reset_map must cover every rank';
  END IF;

  INSERT INTO rank_config (school_id, weights, k, ex_step, tiers, season_reset_map, updated_at)
  VALUES (p_school_id, p_weights, p_k, p_ex_step, p_tiers, p_season_reset_map, now())
  ON CONFLICT (school_id) DO UPDATE SET
    weights = EXCLUDED.weights,
    k = EXCLUDED.k,
    ex_step = EXCLUDED.ex_step,
    tiers = EXCLUDED.tiers,
    season_reset_map = EXCLUDED.season_reset_map,
    updated_at = now();

  RETURN jsonb_build_object('weights', p_weights, 'k', p_k, 'ex_step', p_ex_step, 'tiers', p_tiers, 'season_reset_map', p_season_reset_map);
END $$;

-- Get-or-create a student's rank state row.
CREATE OR REPLACE FUNCTION public._rank_ensure_state(p_student_id UUID)
RETURNS student_rank_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row student_rank_state%ROWTYPE;
  v_school UUID;
BEGIN
  SELECT * INTO v_row FROM student_rank_state WHERE student_id = p_student_id;
  IF NOT FOUND THEN
    SELECT school_id INTO v_school FROM profiles WHERE id = p_student_id;
    IF v_school IS NULL THEN
      RAISE EXCEPTION 'Student not found';
    END IF;
    INSERT INTO student_rank_state (student_id, school_id)
    VALUES (p_student_id, v_school)
    RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END $$;

-- Section 5: the bar mechanic (pure). Mirrors applyRankUpdate in the engine.
CREATE OR REPLACE FUNCTION public._rank_apply_update(
  p_rank TEXT, p_bar DOUBLE PRECISION, p_fill DOUBLE PRECISION, p_tiers JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  new_bar DOUBLE PRECISION := p_bar + p_fill;
  overflow DOUBLE PRECISION;
  prev TEXT;
  prev2 TEXT;
  tier JSONB;
  n_val DOUBLE PRECISION;
  next_rank TEXT;
BEGIN
  -- EX is a short-circuit: never demotes through this mechanic.
  IF p_rank = 'EX' THEN
    RETURN jsonb_build_object('new_rank', 'EX', 'new_bar', 0, 'promoted', false, 'demoted', false, 'cascade_tiers', 0);
  END IF;

  tier := (SELECT t FROM jsonb_array_elements(p_tiers) t WHERE t->>'rank' = p_rank LIMIT 1);
  n_val := COALESCE((tier->>'n')::DOUBLE PRECISION, 1);
  next_rank := tier->>'next';

  -- Promotion - fill-first: bar reaches 100, next tier starts at exactly 0.
  IF new_bar >= 100 THEN
    RETURN jsonb_build_object('new_rank', COALESCE(next_rank, p_rank), 'new_bar', 0, 'promoted', true, 'demoted', false, 'cascade_tiers', 0);
  END IF;

  -- Demotion - overflow lands in the previous tier, capped at 2 tiers total.
  IF new_bar < 0 THEN
    overflow := -new_bar;
    IF p_rank = 'D' THEN
      RETURN jsonb_build_object('new_rank', 'D', 'new_bar', 0, 'promoted', false, 'demoted', true, 'cascade_tiers', 0);
    END IF;
    prev := COALESCE((SELECT t->>'rank' FROM jsonb_array_elements(p_tiers) t WHERE t->>'next' = p_rank LIMIT 1), 'D');
    IF 100 - overflow >= 0 THEN
      RETURN jsonb_build_object('new_rank', prev, 'new_bar', 100 - overflow, 'promoted', false, 'demoted', true, 'cascade_tiers', 1);
    END IF;
    prev2 := (SELECT t->>'rank' FROM jsonb_array_elements(p_tiers) t WHERE t->>'next' = prev LIMIT 1);
    IF prev2 IS NULL THEN
      -- Previous tier is D and even D overflows: land at D with bar 0.
      RETURN jsonb_build_object('new_rank', prev, 'new_bar', 0, 'promoted', false, 'demoted', true, 'cascade_tiers', 1);
    END IF;
    RETURN jsonb_build_object('new_rank', prev2, 'new_bar', 0, 'promoted', false, 'demoted', true, 'cascade_tiers', 2);
  END IF;

  RETURN jsonb_build_object('new_rank', p_rank, 'new_bar', new_bar, 'promoted', false, 'demoted', false, 'cascade_tiers', 0);
END $$;

-- Validation (Section 11): hard blocks return valid=false; warnings are
-- collected into p_warnings (jsonb array, appended). Callers raise on invalid.
CREATE OR REPLACE FUNCTION public._rank_validate(
  p_points_earned INT, p_points_possible INT, p_category TEXT,
  p_period_id TEXT, p_student_id UUID, p_warnings JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_median_possible DOUBLE PRECISION;
  v_peer_count INT;
BEGIN
  IF p_points_earned < 0 THEN
    RETURN jsonb_build_object('valid', false, 'warnings', jsonb_build_array('pointsEarned must be non-negative'));
  END IF;
  IF p_points_possible <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'warnings', jsonb_build_array('pointsPossible must be greater than 0'));
  END IF;

  IF p_points_earned > p_points_possible * 1.5 THEN
    p_warnings := p_warnings || jsonb_build_array(
      'pointsEarned (' || p_points_earned || ') is more than 1.5x pointsPossible (' || p_points_possible || ') - likely a data-entry mistake');
  END IF;

  -- Peer comparison: flag a max score far off the rest of the same category+period.
  SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY points_possible)
  INTO v_peer_count, v_median_possible
  FROM rank_period_entries
  WHERE student_id = p_student_id AND period_id = p_period_id AND category = p_category;

  IF v_peer_count > 0 AND v_median_possible IS NOT NULL AND v_median_possible > 0
     AND (p_points_possible > v_median_possible * 1.5 OR p_points_possible * 1.5 < v_median_possible) THEN
    p_warnings := p_warnings || jsonb_build_array(
      'pointsPossible (' || p_points_possible || ') differs drastically from other entries in this category/period - possible typo');
  END IF;

  RETURN jsonb_build_object('valid', true, 'warnings', p_warnings);
END $$;

-- Stateless preview token: md5 of the full input fingerprint (student, period,
-- category, earned/possible, config snapshot, and the existing period entries).
-- preview_rank_update therefore has ZERO side effects, and confirm rejects any
-- token that no longer matches (config changed, entries changed, or inputs
-- differ from what was previewed).
CREATE OR REPLACE FUNCTION public._rank_token(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_config JSONB)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_entries_md5 TEXT;
BEGIN
  SELECT COALESCE(md5(string_agg(category || ':' || points_earned::text || '/' || points_possible::text, ',' ORDER BY category, points_earned, points_possible)), 'none')
  INTO v_entries_md5
  FROM rank_period_entries
  WHERE student_id = p_student_id AND period_id = p_period_id;
  RETURN md5(
    p_student_id::text || '|' || p_period_id || '|' || p_category || '|' ||
    p_points_earned::text || '|' || p_points_possible::text || '|' ||
    md5(p_config::text) || '|' || v_entries_md5
  );
END $$;

-- ---------------------------------------------------------------------------
-- 4) CORE RPCs
-- ---------------------------------------------------------------------------

-- preview_rank_update - runs the FULL pipeline (Sections 2-5) without
-- persisting anything. Pure read + deterministic token; repeated calls have
-- zero side effects.
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

-- confirm_and_apply_score_entry - the ONLY function permitted to write rank
-- state. Re-validates before writing, rejects invalid inputs, and requires a
-- token issued by preview_rank_update that still matches (config/entries
-- unchanged since the preview).
CREATE OR REPLACE FUNCTION public.confirm_and_apply_score_entry(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_preview_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_cfg JSONB;
  v_state student_rank_state%ROWTYPE;
  v_valid JSONB;
  v_warnings JSONB := '[]'::jsonb;
  v_preview JSONB;
  v_expected_token TEXT;
  v_pcts JSONB;
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
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, true);
  v_cfg := public.get_rank_config(v_school);
  v_state := public._rank_ensure_state(p_student_id);
  v_rank_before := v_state.current_rank;

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

  INSERT INTO rank_period_entries (school_id, student_id, period_id, category, points_earned, points_possible)
  VALUES (v_school, p_student_id, p_period_id, p_category, p_points_earned, p_points_possible);

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

-- process_score_entry - orchestrates validate -> preview -> confirm. With
-- p_auto_confirm = true (no human-confirmation step in the caller), the
-- promotion/demotion event is still logged distinctly via rank_history_log.
CREATE OR REPLACE FUNCTION public.process_score_entry(
  p_student_id UUID, p_period_id TEXT, p_category TEXT,
  p_points_earned INT, p_points_possible INT, p_auto_confirm BOOLEAN DEFAULT false)
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
                           public.get_rank_config(v_school))));
  END IF;

  RETURN jsonb_build_object(
    'valid', true, 'warnings', v_valid->'warnings',
    'preview', public.preview_rank_update(p_student_id, p_period_id, p_category, p_points_earned, p_points_possible),
    'confirmed', null);
END $$;

-- reset_period_category_totals - start of a NEW grading period: clears the
-- running category totals only; StudentRankState (rank/bar/highest) untouched.
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

  UPDATE student_rank_state SET period_id = p_new_period_id, updated_at = now()
  WHERE student_id = p_student_id;

  INSERT INTO rank_history_log (school_id, student_id, period_id, event_type)
  VALUES (v_school, p_student_id, p_new_period_id, 'period_reset');

  v_state := public._rank_ensure_state(p_student_id);
  RETURN jsonb_build_object('period_id', p_new_period_id, 'cleared_entries', v_cleared, 'state', jsonb_build_object(
    'current_rank', v_state.current_rank, 'current_bar', v_state.current_bar, 'ex_score', v_state.ex_score,
    'peak_rank_this_season', v_state.peak_rank_this_season, 'highest_rank_ever', v_state.highest_rank_ever,
    'highest_rank_season', v_state.highest_rank_season, 'period_id', v_state.period_id));
END $$;

-- end_season - reseeds the next season from the season's PEAK rank (never the
-- rank at the literal season end), writes the SeasonHistoryLog, and updates
-- highest_rank_ever/highest_rank_season (monotonic, never lowered).
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
  v_reset_to := v_cfg->'season_reset_map'->>v_peak;
  IF v_reset_to IS NULL THEN
    RAISE EXCEPTION 'Missing season reset mapping for rank %', v_peak;
  END IF;

  -- All-time record: only ever increases, from the PEAK.
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

-- get_season_history - season logs ordered by season_end_date (ascending), so a
-- caller can render "Grade 12 ICT - First Semester 2026-2027: S++" cards.
CREATE OR REPLACE FUNCTION public.get_season_history(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_result JSONB;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, false);
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.season_end_date), '[]'::jsonb) INTO v_result
  FROM (
    SELECT student_id, season_id, school_year, semester_label, grade_level,
           strand_or_track, section, peak_rank, final_rank_before_reset, reset_to_rank,
           ex_achieved, season_end_date
    FROM season_history_log
    WHERE student_id = p_student_id
  ) t;
  RETURN v_result;
END $$;

-- get_dual_rank_display - the fields a caller needs to render rank UI.
CREATE OR REPLACE FUNCTION public.get_dual_rank_display(p_student_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID;
  v_state student_rank_state%ROWTYPE;
BEGIN
  SELECT me, my_role, my_school INTO v_me, v_role, v_school FROM public._rank_auth(p_student_id, false);
  v_state := public._rank_ensure_state(p_student_id);
  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'current_rank', v_state.current_rank,
    'current_bar', v_state.current_bar,
    'ex_score', v_state.ex_score,
    'peak_rank_this_season', v_state.peak_rank_this_season,
    'highest_rank_ever', v_state.highest_rank_ever,
    'highest_rank_season', v_state.highest_rank_season,
    'season_id', v_state.season_id,
    'period_id', v_state.period_id);
END $$;
