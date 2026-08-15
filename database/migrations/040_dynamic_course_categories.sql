-- ===========================================================================
-- 040_dynamic_course_categories.sql
-- Makes course categories DYNAMIC: a teacher can add, remove, and edit the
-- category list per course (label + weight %), instead of the fixed four
-- (quiz/exam/activity/participation).
--
--   1. course_rank_categories child table replaces course_rank_weights
--      (which held a fixed 4-key JSONB). One row per category:
--      (course_id, category_key, label, weight). category_key is the slug
--      used inside the rank engine; label is what the teacher sees and what
--      grade_entries.type stores.
--   2. grade_entries.type CHECK is dropped - type now holds a category LABEL
--      which can be anything the teacher configured.
--   3. rank_period_entries.category CHECK is dropped - the engine's composite
--      already iterates DISTINCT categories from the entries and joins to the
--      weights jsonb by key, so it is category-agnostic.
--   4. save_course_rank_weights now takes an ARRAY of {key,label,weight} and
--      replaces the whole set (add/remove/edit in one call); weights must
--      sum to 100. get_course_rank_weights returns the array (or the school
--      default four categories when none are configured).
--   5. The feed trigger maps grade_entries.type (a label) -> category_key via
--      course_rank_categories, falling back to the legacy built-in mapping
--      when the course has no custom categories. Weights passed to the engine
--      are built from the course's current category rows.
--   6. revert_grade_rank_feed's replay is rewritten to be category-agnostic
--      (same DISTINCT-category + weights-join math as preview_rank_update),
--      so reverts never break for custom categories.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP ... IF EXISTS.
-- ===========================================================================

-- 1) Dynamic category rows ----------------------------------------------------
CREATE TABLE IF NOT EXISTS course_rank_categories (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  label TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  PRIMARY KEY (course_id, category_key)
);
CREATE INDEX IF NOT EXISTS idx_course_categories_course ON course_rank_categories(course_id);

ALTER TABLE course_rank_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_categories_school_read" ON course_rank_categories;
CREATE POLICY "course_categories_school_read" ON course_rank_categories FOR SELECT USING (
  EXISTS (SELECT 1 FROM courses c JOIN profiles p ON p.school_id = c.school_id
          WHERE c.id = course_rank_categories.course_id AND p.user_id = auth.uid())
);
DROP POLICY IF EXISTS "course_categories_teacher_write" ON course_rank_categories;
CREATE POLICY "course_categories_teacher_write" ON course_rank_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM courses c
          WHERE c.id = course_rank_categories.course_id
            AND (c.teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
                 OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = c.school_id)))
);

-- The old fixed-4 JSONB table is replaced (it was empty on live).
DROP TABLE IF EXISTS course_rank_weights;

-- 2) + 3) Relax the fixed CHECK constraints -----------------------------------
ALTER TABLE grade_entries DROP CONSTRAINT IF EXISTS grade_entries_type_check;
ALTER TABLE rank_period_entries DROP CONSTRAINT IF EXISTS rank_period_entries_category_check;

-- 4) Save/get categories as an array ------------------------------------------
DROP FUNCTION IF EXISTS public.save_course_rank_weights(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.save_course_rank_weights(p_course_id UUID, p_categories JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me UUID; v_role TEXT; v_school UUID; v_course_school UUID;
  v_cat JSONB;
  v_sum DOUBLE PRECISION := 0;
  v_keys TEXT[] := '{}';
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

  IF v_role <> 'admin' AND NOT EXISTS (
    SELECT 1 FROM courses WHERE id = p_course_id AND teacher_id = v_me
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF v_school IS DISTINCT FROM v_course_school THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;

  IF p_categories IS NULL OR jsonb_typeof(p_categories) <> 'array' OR jsonb_array_length(p_categories) = 0 THEN
    RAISE EXCEPTION 'At least one category is required';
  END IF;

  FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories) LOOP
    IF (v_cat->>'key') IS NULL OR trim(v_cat->>'key') = ''
       OR (v_cat->>'label') IS NULL OR trim(v_cat->>'label') = ''
       OR (v_cat->>'weight') IS NULL OR NOT (v_cat->>'weight') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Each category needs key, label and a numeric weight';
    END IF;
    IF (v_cat->>'weight')::DOUBLE PRECISION < 0 THEN
      RAISE EXCEPTION 'Weights cannot be negative';
    END IF;
    IF (v_cat->>'key') = ANY (v_keys) THEN
      RAISE EXCEPTION 'Duplicate category key: %', v_cat->>'key';
    END IF;
    v_keys := v_keys || (v_cat->>'key');
    v_sum := v_sum + (v_cat->>'weight')::DOUBLE PRECISION;
  END LOOP;

  IF abs(v_sum - 100) > 0.01 THEN
    RAISE EXCEPTION 'Weights must sum to 100 (got %)', round(v_sum::numeric, 2);
  END IF;

  -- Replace the whole set atomically (add / remove / edit). The alias is
  -- NOT named v_cat - that name is the PL/pgSQL loop variable above, and
  -- reusing it here makes the reference ambiguous.
  DELETE FROM course_rank_categories WHERE course_id = p_course_id;
  INSERT INTO course_rank_categories (course_id, category_key, label, weight)
  SELECT p_course_id, (c->>'key'), (c->>'label'), (c->>'weight')::DOUBLE PRECISION
  FROM jsonb_array_elements(p_categories) AS c;

  RETURN jsonb_build_object('course_id', p_course_id, 'categories', p_categories);
END $$;

DROP FUNCTION IF EXISTS public.get_course_rank_weights(uuid);
CREATE OR REPLACE FUNCTION public.get_course_rank_weights(p_course_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school UUID;
  v_categories JSONB;
  v_cfg JSONB;
BEGIN
  SELECT school_id INTO v_school FROM courses WHERE id = p_course_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.school_id = v_school) THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('key', category_key, 'label', label, 'weight', weight) ORDER BY category_key), '[]'::jsonb)
  INTO v_categories
  FROM course_rank_categories WHERE course_id = p_course_id;

  IF jsonb_array_length(v_categories) = 0 THEN
    -- School default four categories (as percents).
    v_cfg := public.get_rank_config(v_school);
    v_categories := jsonb_build_array(
      jsonb_build_object('key', 'quiz', 'label', 'Quiz', 'weight', round(((v_cfg->'weights'->>'quiz')::DOUBLE PRECISION * 100)::numeric, 1)),
      jsonb_build_object('key', 'exam', 'label', 'Exam', 'weight', round(((v_cfg->'weights'->>'exam')::DOUBLE PRECISION * 100)::numeric, 1)),
      jsonb_build_object('key', 'activity', 'label', 'Activity', 'weight', round(((v_cfg->'weights'->>'activity')::DOUBLE PRECISION * 100)::numeric, 1)),
      jsonb_build_object('key', 'participation', 'label', 'Participation', 'weight', round(((v_cfg->'weights'->>'participation')::DOUBLE PRECISION * 100)::numeric, 1)));
  END IF;
  RETURN v_categories;
END $$;

-- 5) Feed: label -> category_key via course_rank_categories -------------------
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
    -- Map the grade's type (a category LABEL) to its category key. If the
    -- course has custom categories, use them; otherwise fall back to the
    -- legacy built-in mapping.
    SELECT crc.category_key INTO v_category
    FROM course_rank_categories crc WHERE crc.course_id = NEW.course_id AND crc.label = NEW.type;
    IF v_category IS NULL THEN
      v_category := CASE NEW.type
        WHEN 'Exam' THEN 'exam'
        WHEN 'Quiz' THEN 'quiz'
        WHEN 'Participation' THEN 'participation'
        ELSE 'activity'  -- Activity + Assignment
      END;
    END IF;

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

    -- Course weights as fractions for the engine (only if the course has
    -- configured categories; otherwise the engine uses the school default).
    SELECT COALESCE(jsonb_object_agg(crc.category_key, crc.weight / 100.0), NULL)
    INTO v_weights
    FROM course_rank_categories crc WHERE crc.course_id = NEW.course_id;

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

-- 6) Revert replay: category-agnostic -----------------------------------------
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

  v_rank := COALESCE(v_entry.rank_before, 'C');
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
