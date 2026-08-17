-- 058: Account lifecycle.
--
--   A) Deactivation flag. Self-service deactivation is a reversible flag on
--      profiles: the account stops being usable (middleware + leaderboard
--      filter) but NO data is deleted. Reactivation just clears the flag.
--
--   B) Deletion-safe foreign keys. Permanent deletion deletes the auth user
--      (auth.users -> profiles ON DELETE CASCADE from migration 001). School-
--      required historical records must SURVIVE that cascade, anonymized:
--      their profiles reference is switched to ON DELETE SET NULL so the
--      record (grade, enrollment, season/rank history, borrow history,
--      teacher/admin attribution) stays intact with the identity removed.
--      Personal user-owned data keeps ON DELETE CASCADE (habits, stories,
--      achievements, music, chat, notifications, shop, etc. - all already
--      cascade). quiz_attempts (personal test results) is switched from NO
--      ACTION to CASCADE so profile deletion no longer fails on it.
--
--   C) Deactivated students drop out of the leaderboard.

-- ---------------------------------------------------------------------------
-- A) Deactivation flag
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_deactivated ON profiles(deactivated_at) WHERE deactivated_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- B) Deletion-safe FK behavior
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec record;
  con_name text;
  allow_null boolean;
  action_sql text;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    -- School-required academic records: preserve + anonymize (SET NULL).
    ('grade_entries',          'student_id',    'SET NULL', true),
    ('grade_entries',          'submitted_by',  'SET NULL', true),
    ('course_enrollments',     'student_id',    'SET NULL', true),
    ('rank_period_entries',    'student_id',    'SET NULL', true),
    ('season_history_log',     'student_id',    'SET NULL', true),
    ('rank_history_log',       'student_id',    'SET NULL', true),
    -- Teacher/admin attribution on school-owned content: keep content, drop identity.
    ('learning_materials',     'uploaded_by',   'SET NULL', true),
    ('quizzes',                'created_by',    'SET NULL', true),
    ('teacher_tasks',          'assigned_by',   'SET NULL', true),
    -- Library: keep the book/history, remove the borrower identity.
    ('library_books',          'borrowed_by',   'SET NULL', true),
    ('library_borrow_log',     'student_id',    'SET NULL', true),
    -- Personal test results: delete with the profile (was NO ACTION -> would
    -- have blocked deletion).
    ('quiz_attempts',          'student_id',    'CASCADE',  false)
  ) AS t(tbl, col, action, nullable) LOOP
    action_sql := CASE rec.action WHEN 'SET NULL' THEN 'SET NULL' ELSE 'CASCADE' END;
    allow_null := rec.nullable;

    SELECT conname INTO con_name
    FROM pg_constraint
    WHERE conrelid = rec.tbl::regclass AND contype = 'f'
      AND conkey = (
        SELECT ARRAY[a.attnum] FROM pg_attribute a
        WHERE a.attrelid = rec.tbl::regclass AND a.attname = rec.col
      );

    IF con_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.tbl, con_name);
    END IF;

    IF allow_null THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', rec.tbl, rec.col);
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I_%I_fkey FOREIGN KEY (%I) REFERENCES profiles(id) ON DELETE %s',
      rec.tbl, rec.tbl, rec.col, rec.col, action_sql
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- C) Leaderboard excludes deactivated students (server-side).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_school_leaderboard();

CREATE FUNCTION public.get_school_leaderboard()
RETURNS TABLE(
  student_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  level_label TEXT,
  section TEXT,
  educational_level TEXT,
  program_name TEXT,
  academic_excellence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_school UUID;
BEGIN
  SELECT school_id INTO my_school FROM profiles WHERE user_id = auth.uid();
  IF my_school IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT p.id AS student_id,
         p.full_name,
         p.avatar_url,
         p.level_label,
         p.section,
         p.educational_level,
         (
           SELECT pr.name
           FROM course_enrollments ce
           JOIN courses c ON c.id = ce.course_id
           JOIN sections s ON s.id = c.section_id
           JOIN programs pr ON pr.id = s.program_id
           WHERE ce.student_id = p.id
           ORDER BY ce.created_at ASC
           LIMIT 1
         ) AS program_name,
         CASE WHEN COUNT(ge.id) = 0 THEN NULL::numeric
              ELSE ROUND(AVG(ge.score)::numeric, 1)
         END AS academic_excellence
  FROM profiles p
  LEFT JOIN grade_entries ge
    ON ge.student_id = p.id AND ge.approval_status = 'approved'
  WHERE p.school_id = my_school AND p.role = 'student'
    AND p.deactivated_at IS NULL
  GROUP BY p.id, p.full_name, p.avatar_url, p.level_label, p.section, p.educational_level
  ORDER BY academic_excellence DESC NULLS LAST;
END;
$$;
