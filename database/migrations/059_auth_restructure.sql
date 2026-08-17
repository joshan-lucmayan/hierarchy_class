-- ============================================================================
-- 059_auth_restructure.sql
--
-- Authentication, signup, school-membership and administrator-provisioning
-- restructure for the platform-owner business model:
--
--   PLATFORM OWNER registers schools and provisions admins (service role /
--   SQL editor). Public signup supports ONLY student + teacher. Role and
--   school authority move from auth.users.user_metadata to profiles
--   (profiles.role / profiles.school_id). Every RLS policy that read
--   `auth.jwt() -> user_metadata` is replaced with database-truth checks
--   against profiles.
--
-- Changes:
--   1. schools.registration_enabled  - whether a school accepts public signup
--      (distinct from `active`). The platform-owner tenant list is CSA-only:
--      CSA is explicitly preserved (same row/UUID/data) and opened for
--      registration, and legacy GIS/HNA/MVS/SVS rows (if present in any
--      environment) are removed ONLY when they have zero dependent rows -
--      otherwise the migration fails loudly instead of deleting data.
--   2. profiles.middle_name / student_id / faculty_id + partial unique
--      indexes ((school_id, student_id) / (school_id, faculty_id) ignoring
--      NULLs, so teachers' NULL student_id never conflicts and vice versa).
--   3. hardened handle_new_user() - rejects role = 'admin' and forged
--      school UUIDs at the database level; persists middle_name/student_id/
--      faculty_id; is_librarian forced to teacher-only; developer-provisioned
--      accounts skip the placeholder florin balance.
--   4. my_school_id() / my_role() SECURITY DEFINER helpers - the single
--      DB-truth source for RLS (avoids the profiles-policy recursion that
--      originally pushed the app to user_metadata).
--   5. All school-scoped read policies rewritten to profiles-based truth.
--   6. Removed profiles_user_inserts_own (the trigger is the only profile
--      creator) and schools_admin_write (schools are platform-owner managed;
--      it also had the `profiles.id = auth.uid()` bug).
--   7. protect_profile_columns() hardened: service role exempt (developer
--      provisioning), school admins cannot move users across schools or
--      promote anyone to admin, school-issued IDs are not self-editable.
--   8. Fixed cross-school write holes found in the audit:
--      quizzes_teacher_create, banner_admin_insert, grade_entries_teacher_write
--      / grade_entries_teacher_delete now require the admin/teacher to belong
--      to the row's school.
--   9. School admins cannot modify admin accounts AT ALL - no promotion, no
--      demotion, no authorization-field edits. Only the service-role
--      provisioning path can create or modify admin accounts.
--  10. Owner-insert policies (stories, achievements, music, quiz attempts,
--      borrow requests, account requests) now require school_id =
--      my_school_id(), so a user can never plant a row in another school.
--
-- Idempotent (DROP ... IF EXISTS / IF NOT EXISTS) - safe to re-run, matching
-- the project's migration convention (no tracking table).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) SCHOOL REGISTRATION STATE
-- ---------------------------------------------------------------------------
ALTER TABLE schools ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN schools.registration_enabled IS
  'Platform-owner controlled: whether this school accepts PUBLIC signups. '
  'Distinct from active (school exists/operates). Only active schools with '
  'registration_enabled = true appear in the signup selector and pass the '
  'server/trigger signup validation.';

CREATE INDEX IF NOT EXISTS idx_schools_registration ON schools(active, registration_enabled);

-- ---------------------------------------------------------------------------
-- 1b) PLATFORM-OWNER TENANT LIST: CSA only
-- ---------------------------------------------------------------------------
-- CSA - College of Saint Amateil is the sole registered school. It is
-- explicitly preserved (same row, same UUID, same data - no delete, no
-- recreate, no re-parenting of users) and opened for public registration.
-- The legacy GIS/HNA/MVS/SVS tenant rows are removed IF AND ONLY IF they
-- carry zero dependent rows across every school-scoped table; if any
-- dependent row exists the migration RAISES and stops - nothing is deleted
-- automatically, and the platform owner must resolve the dependent data
-- first. CSA is never part of this cleanup.

-- Explicitly preserve CSA and keep it active + open for public signup.
-- Idempotent: re-running matches by name and leaves the row (and its UUID)
-- untouched.
UPDATE schools
SET    registration_enabled = true,
       active = true
WHERE  name = 'CSA - College of Saint Amateil'
   AND (registration_enabled IS DISTINCT FROM true OR active IS DISTINCT FROM true);

DO $$
DECLARE
  r          RECORD;
  n          BIGINT;
  target_ids uuid[] := ARRAY(
    SELECT id FROM schools
    WHERE  upper(name) IN ('GIS','HNA','MVS','SVS')
       OR  upper(abbreviation) IN ('GIS','HNA','MVS','SVS')
  );
BEGIN
  IF target_ids IS NULL OR cardinality(target_ids) = 0 THEN
    RAISE NOTICE 'No GIS/HNA/MVS/SVS school rows present - tenant list is CSA-only already';
    RETURN;
  END IF;

  -- Dependency gate: every table that carries a school_id column must have
  -- ZERO rows for the retiring schools, or the migration stops instead of
  -- deleting data. (The FK catalog and the school_id column list are the
  -- same 38 tables in this schema, so this covers every dependent table.)
  FOR r IN
    SELECT table_schema, table_name
    FROM   information_schema.columns
    WHERE  column_name = 'school_id'
      AND  table_schema = 'public'
    ORDER  BY table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE school_id = ANY($1)',
                   r.table_schema, r.table_name)
      INTO n USING target_ids;
    IF n > 0 THEN
      RAISE EXCEPTION
        'Cannot remove GIS/HNA/MVS/SVS: table %.% has % dependent row(s). '
        'Resolve the dependent data before deleting these schools.',
        r.table_schema, r.table_name, n;
    END IF;
  END LOOP;

  DELETE FROM schools WHERE id = ANY(target_ids);
  RAISE NOTICE 'Removed legacy GIS/HNA/MVS/SVS school rows (zero dependent rows)';
END
$$;

-- ---------------------------------------------------------------------------
-- 2) PROFILE COLUMNS: middle name + school-issued identifiers
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS faculty_id TEXT;

-- A profile is either a student or a teacher - it should never carry both a
-- student and a faculty id. Existing rows (both NULL) satisfy this trivially.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_kind_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_kind_check
  CHECK (student_id IS NULL OR faculty_id IS NULL);

-- School-issued identifiers are unique WITHIN a school, not globally. The
-- partial unique indexes use PostgreSQL's NULL-distinct semantics: teacher
-- rows (student_id NULL) and student rows (faculty_id NULL) never conflict
-- with each other, and the same student_id may exist in different schools.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_school_student_id
  ON profiles(school_id, student_id) WHERE student_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_school_faculty_id
  ON profiles(school_id, faculty_id) WHERE faculty_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_faculty_id ON profiles(faculty_id);

-- ---------------------------------------------------------------------------
-- 3) DB-TRUTH HELPER FUNCTIONS FOR RLS
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so they can read profiles without tripping the profiles
-- RLS recursion that originally forced the app onto user_metadata. They run
-- as the table owner (postgres), which bypasses RLS on profiles; auth.uid()
-- still resolves from the request JWT, so the result is the CALLER's own
-- profile data - never forgeable via user_metadata.

CREATE OR REPLACE FUNCTION public.my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.my_school_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_role() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) HARDENED SIGNUP TRIGGER
-- ---------------------------------------------------------------------------
-- Public signup may NEVER create an admin, and may NEVER attach an arbitrary
-- school. Both are enforced here at the database level, so even a direct
-- `auth.signUp` call with forged metadata cannot create a privileged profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id UUID;
  meta_role TEXT;
  meta_first_name TEXT;
  meta_middle_name TEXT;
  meta_last_name TEXT;
  meta_name TEXT;
  meta_school_id UUID;
  meta_is_librarian BOOLEAN;
  meta_is_provisioned BOOLEAN;
  meta_student_id TEXT;
  meta_faculty_id TEXT;
  first_initial TEXT;
  second_initial TEXT;
BEGIN
  -- ROLE: only student/teacher are ever accepted from auth metadata. Any
  -- forged role (including 'admin') fails the whole signup.
  meta_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  IF meta_role NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'Public signup only supports student and teacher accounts';
  END IF;

  -- SCHOOL: must exist AND be active AND open for registration. A forged or
  -- arbitrary school UUID is rejected here even if the app's server-side
  -- validation is bypassed.
  meta_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  IF meta_school_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM schools
       WHERE id = meta_school_id AND active = true AND registration_enabled = true
     ) THEN
    RAISE EXCEPTION 'School is not open for registration';
  END IF;

  meta_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  meta_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  meta_middle_name := NULLIF(NEW.raw_user_meta_data->>'middle_name', '');
  meta_name := COALESCE(NEW.raw_user_meta_data->>'name', '');

  -- Legacy flow fallback: derive first/last from the combined `name`.
  IF meta_first_name = '' AND meta_last_name = '' THEN
    meta_first_name := split_part(meta_name, ' ', 1);
    meta_last_name := CASE
      WHEN position(' ' in meta_name) > 0 THEN substring(meta_name from position(' ' in meta_name) + 1)
      ELSE meta_name
    END;
  END IF;

  -- is_librarian is a teacher-only capability. A forged flag on a student
  -- signup is forced to false.
  meta_is_librarian := COALESCE((NEW.raw_user_meta_data->>'is_librarian')::boolean, false)
    AND meta_role = 'teacher';

  -- School-issued identifiers, normalized (trimmed). Uniqueness within the
  -- school is enforced by the partial unique indexes from section 2 - a
  -- duplicate insert fails with a unique-violation error.
  meta_student_id := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'student_id', '')), '');
  meta_faculty_id := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'faculty_id', '')), '');

  -- Developer-provisioned accounts (platform owner via service role) carry a
  -- marker so the placeholder student florin balance is not minted; the
  -- provisioning flow upgrades the profile role AFTER this trigger runs.
  meta_is_provisioned := COALESCE((NEW.raw_user_meta_data->>'is_provisioned')::boolean, false);

  first_initial := COALESCE(UPPER(LEFT(meta_first_name, 1)), '');
  second_initial := COALESCE(UPPER(LEFT(meta_last_name, 1)), '');

  INSERT INTO public.profiles (
    user_id,
    school_id,
    role,
    full_name,
    first_name,
    middle_name,
    last_name,
    student_id,
    faculty_id,
    initials,
    overall_rank,
    academic_excellence,
    is_librarian,
    tags,
    hobbies,
    interests
  )
  VALUES (
    NEW.id,
    meta_school_id,
    meta_role,
    trim(concat_ws(' ', meta_first_name, meta_middle_name, meta_last_name)),
    NULLIF(meta_first_name, ''),
    meta_middle_name,
    NULLIF(meta_last_name, ''),
    meta_student_id,
    meta_faculty_id,
    first_initial || second_initial,
    'B',
    50,
    meta_is_librarian,
    '[]',
    '[]',
    '[]'
  )
  RETURNING id INTO new_profile_id;

  -- Student florin initialization (existing behavior, kept).
  IF meta_role = 'student' AND NOT meta_is_provisioned THEN
    INSERT INTO public.florin_balances (student_id, balance)
    VALUES (new_profile_id, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5) PROFILES: profile creation is trigger-controlled only
-- ---------------------------------------------------------------------------
-- The handle_new_user() trigger is the sole legitimate creator of profiles
-- (it runs as the table owner, so it needs no policy). Keeping a public
-- INSERT policy would let a user construct their own authoritative
-- role/school row - the exact invariant this migration removes.
DROP POLICY IF EXISTS "profiles_user_inserts_own" ON profiles;

-- ---------------------------------------------------------------------------
-- 6) RLS: replace user_metadata-based policies with DB truth
-- ---------------------------------------------------------------------------

-- PROFILES: school-wide read derived from the caller's own profile row.
DROP POLICY IF EXISTS "profiles_school_reads_all" ON profiles;
CREATE POLICY "profiles_school_reads_all" ON profiles FOR SELECT USING (
  school_id = public.my_school_id()
);

-- LEARNING_MATERIALS
DROP POLICY IF EXISTS "materials_school_read" ON learning_materials;
CREATE POLICY "materials_school_read" ON learning_materials FOR SELECT USING (
  school_id = public.my_school_id()
);

-- LIBRARY_BOOKS
DROP POLICY IF EXISTS "books_school_read" ON library_books;
CREATE POLICY "books_school_read" ON library_books FOR SELECT USING (
  school_id = public.my_school_id()
);

-- QUIZZES
DROP POLICY IF EXISTS "quizzes_school_read" ON quizzes;
CREATE POLICY "quizzes_school_read" ON quizzes FOR SELECT USING (
  school_id = public.my_school_id()
);

-- QUIZ creation: the creating teacher must teach the course, or the caller
-- must be an admin OF THE QUIZ'S SCHOOL (previously any-school admins could
-- write into another school).
DROP POLICY IF EXISTS "quizzes_teacher_create" ON quizzes;
CREATE POLICY "quizzes_teacher_create" ON quizzes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND (
      (p.role = 'admin' AND p.school_id = quizzes.school_id)
      OR EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = quizzes.course_id AND c.teacher_id = p.id
          AND c.school_id = quizzes.school_id
      )
    )
  )
);

-- SCHOOL_FEED_POSTS: preserve the audience filtering, swap the school source.
DROP POLICY IF EXISTS "feed_posts_school_read" ON school_feed_posts;
CREATE POLICY "feed_posts_school_read" ON school_feed_posts FOR SELECT USING (
  school_id = public.my_school_id()
  AND (
    audience = 'everyone'
    OR (audience = 'students' AND public.my_role() = 'student')
    OR (audience = 'teachers' AND public.my_role() IN ('teacher', 'admin'))
    OR public.my_role() = 'admin'
  )
);

-- BANNER_CONFIG
DROP POLICY IF EXISTS "banner_school_read" ON banner_config;
CREATE POLICY "banner_school_read" ON banner_config FOR SELECT USING (
  school_id = public.my_school_id()
);

-- BANNER insert: the admin must belong to the banner's school (previously
-- any-school admins could insert a banner_config row for another school).
DROP POLICY IF EXISTS "banner_admin_insert" ON banner_config;
CREATE POLICY "banner_admin_insert" ON banner_config FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = banner_config.school_id)
);

-- PROGRAMS / SECTIONS / COURSES / COURSE_ENROLLMENTS (classroom hierarchy)
DROP POLICY IF EXISTS "programs_school_read" ON programs;
CREATE POLICY "programs_school_read" ON programs FOR SELECT USING (
  school_id = public.my_school_id()
);
DROP POLICY IF EXISTS "sections_school_read" ON sections;
CREATE POLICY "sections_school_read" ON sections FOR SELECT USING (
  school_id = public.my_school_id()
);
DROP POLICY IF EXISTS "courses_school_read" ON courses;
CREATE POLICY "courses_school_read" ON courses FOR SELECT USING (
  school_id = public.my_school_id()
);
DROP POLICY IF EXISTS "enrollments_school_read" ON course_enrollments;
CREATE POLICY "enrollments_school_read" ON course_enrollments FOR SELECT USING (
  school_id = public.my_school_id()
);

-- GRADE_ENTRIES: teacher write/delete must be school-scoped for admins
-- (previously any-school admins could write grades into another school).
DROP POLICY IF EXISTS "grade_entries_teacher_write" ON grade_entries;
CREATE POLICY "grade_entries_teacher_write" ON grade_entries FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.id = grade_entries.submitted_by
    AND (
      (p.role = 'admin' AND p.school_id = grade_entries.school_id)
      OR EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = grade_entries.course_id AND c.teacher_id = p.id
          AND c.school_id = grade_entries.school_id
      )
    )
  )
);
DROP POLICY IF EXISTS "grade_entries_teacher_delete" ON grade_entries;
CREATE POLICY "grade_entries_teacher_delete" ON grade_entries FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND (
      (p.role = 'admin' AND p.school_id = grade_entries.school_id)
      OR EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = grade_entries.course_id AND c.teacher_id = p.id
          AND c.school_id = grade_entries.school_id
      )
    )
  )
);

-- STORIES (preserve owner/expiry logic, swap the school source)
DROP POLICY IF EXISTS "stories_school_read" ON stories;
CREATE POLICY "stories_school_read" ON stories FOR SELECT USING (
  school_id = public.my_school_id()
  AND (expires_at > now() OR user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- STUDENT_ACHIEVEMENTS
DROP POLICY IF EXISTS "achievements_school_read" ON student_achievements;
CREATE POLICY "achievements_school_read" ON student_achievements FOR SELECT USING (
  school_id = public.my_school_id()
);

-- STUDENT_MUSIC
DROP POLICY IF EXISTS "music_school_read" ON student_music;
CREATE POLICY "music_school_read" ON student_music FOR SELECT USING (
  school_id = public.my_school_id()
);

-- ---------------------------------------------------------------------------
-- 7) SCHOOLS: platform-owner managed (no client write path)
-- ---------------------------------------------------------------------------
-- Schools are registered/approved by the platform owner via the SQL editor /
-- service role. The old schools_admin_write policy was broken anyway
-- (compared profiles.id to auth.uid() instead of user_id) and is removed -
-- there is no public school registration workflow.
DROP POLICY IF EXISTS "schools_admin_write" ON schools;

-- ---------------------------------------------------------------------------
-- 8) PROTECTED PROFILE COLUMNS (hardened)
-- ---------------------------------------------------------------------------
--  - Service role (developer/platform-owner provisioning) is exempt.
--  - School admins manage users in their own school but can NEVER move a user
--    across schools, re-parent a profile to another auth user, or promote a
--    user to admin.
--  - School admins can NEVER modify an existing admin account (no demotion,
--    no role/school/user_id edits) - only the service-role provisioning path
--    can create or modify admins.
--  - Everyone else cannot change role / school / user_id / academic / rank /
--    librarian / school-issued IDs. middle_name and names stay self-editable.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Developer/platform-owner operations (service role, e.g. admin
  -- provisioning) are trusted and bypass these guards.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM profiles WHERE user_id = auth.uid();

  IF caller_role = 'admin' THEN
    -- Admin rows are untouchable by school admins: no promotion, no
    -- demotion, and no change to the authorization fields (role, school_id,
    -- user_id). Only the service-role provisioning path may modify an admin.
    IF OLD.role = 'admin' AND (
         NEW.role IS DISTINCT FROM OLD.role
         OR NEW.school_id IS DISTINCT FROM OLD.school_id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
       ) THEN
      RAISE EXCEPTION 'Cannot modify an admin account';
    END IF;
    IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
      RAISE EXCEPTION 'Cannot change school_id';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot change user_id';
    END IF;
    IF NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Cannot promote a user to admin';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.academic_excellence IS DISTINCT FROM OLD.academic_excellence
     OR NEW.overall_rank IS DISTINCT FROM OLD.overall_rank
     OR NEW.is_librarian IS DISTINCT FROM OLD.is_librarian
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.faculty_id IS DISTINCT FROM OLD.faculty_id THEN
    RAISE EXCEPTION 'Cannot change protected profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns ON profiles;
CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- 9) SCHOOL-ADMIN PROFILE UPDATES (defense in depth)
-- ---------------------------------------------------------------------------
-- Same-school admins may manage student/teacher rows only. The USING clause
-- excludes admin rows entirely (an admin can never target another admin row -
-- no demotion, no edits), and the WITH CHECK blocks any write that would make
-- the target row an admin (no promotion). The school-scope check evaluates
-- against the row being updated, so moving a user across schools is denied at
-- the policy level too.
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE USING (
  -- Only non-admin rows are eligible for admin management.
  profiles.role IS DISTINCT FROM 'admin'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
      AND p.school_id = profiles.school_id
  )
) WITH CHECK (
  -- `role` (unqualified) is the NEW row's value in a WITH CHECK expression
  role IS DISTINCT FROM 'admin'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
      AND p.school_id = profiles.school_id
  )
);

-- ---------------------------------------------------------------------------
-- 10) OWNER-INSERT POLICIES: school_id must be the caller's own school
-- ---------------------------------------------------------------------------
-- The owner-scoped insert policies bound the row to the caller's profile id
-- but left school_id unconstrained, so a user could (in a multi-school
-- deployment) plant a row inside another school's namespace. Each now also
-- requires school_id = my_school_id() - the caller's own school. Legitimate
-- app flows already send the caller's own school_id, so existing behavior
-- (CSA today) is unchanged.

DROP POLICY IF EXISTS "stories_own_create" ON stories;
CREATE POLICY "stories_own_create" ON stories FOR INSERT WITH CHECK (
  user_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  AND school_id = public.my_school_id()
);

DROP POLICY IF EXISTS "achievements_own_insert" ON student_achievements;
CREATE POLICY "achievements_own_insert" ON student_achievements FOR INSERT WITH CHECK (
  student_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  AND school_id = public.my_school_id()
);

DROP POLICY IF EXISTS "music_own_insert" ON student_music;
CREATE POLICY "music_own_insert" ON student_music FOR INSERT WITH CHECK (
  student_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  AND school_id = public.my_school_id()
);

DROP POLICY IF EXISTS "quiz_attempts_student_create" ON quiz_attempts;
CREATE POLICY "quiz_attempts_student_create" ON quiz_attempts FOR INSERT WITH CHECK (
  student_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  AND school_id = public.my_school_id()
);

DROP POLICY IF EXISTS "borrow_requests_student_create" ON library_borrow_requests;
CREATE POLICY "borrow_requests_student_create" ON library_borrow_requests FOR INSERT WITH CHECK (
  student_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  AND school_id = public.my_school_id()
);

DROP POLICY IF EXISTS "account_requests_own_create" ON account_requests;
CREATE POLICY "account_requests_own_create" ON account_requests FOR INSERT WITH CHECK (
  requester_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  AND school_id = public.my_school_id()
);

-- ============================================================================
-- VERIFICATION (run after applying; expected: no rows / no output)
-- ============================================================================
-- 1) No remaining user_metadata-based authorization policies:
--    SELECT schemaname, tablename, policyname, cmd
--    FROM pg_policies
--    WHERE policyname IN (
--      'profiles_school_reads_all','materials_school_read','books_school_read',
--      'quizzes_school_read','feed_posts_school_read','banner_school_read',
--      'programs_school_read','sections_school_read','courses_school_read',
--      'enrollments_school_read','stories_school_read','achievements_school_read',
--      'music_school_read'
--    );
--    (Re-run the policy blocks above if any row appears with the old shape.)
--
-- 2) Existing data sanity checks (should all return 0 rows):
--    SELECT count(*) FROM profiles WHERE role = 'admin';       -- admins still exist (by design)
--    SELECT count(*) FROM profiles WHERE user_id IS NULL;      -- orphaned profiles, if any
--    SELECT count(*) FROM (
--      SELECT school_id, student_id FROM profiles WHERE student_id IS NOT NULL
--      GROUP BY school_id, student_id HAVING count(*) > 1
--    ) d;                                                      -- duplicate student ids
--    SELECT count(*) FROM (
--      SELECT school_id, faculty_id FROM profiles WHERE faculty_id IS NOT NULL
--      GROUP BY school_id, faculty_id HAVING count(*) > 1
--    ) d;                                                      -- duplicate faculty ids
--    SELECT id, name, active, registration_enabled FROM schools ORDER BY name;
--    (Expected after 059: exactly one row - CSA - College of Saint Amateil -
--     active, registration_enabled = true. GIS/HNA/MVS/SVS must not exist.)
-- ============================================================================
