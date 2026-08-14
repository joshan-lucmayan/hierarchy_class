-- Fixes: teacher/admin roster and user-management queries silently
-- returning zero rows.
--
-- Root cause: migration 002 fixed RLS recursion for learning_materials,
-- library_books, quizzes, school_feed_posts, and banner_config, but never
-- re-added an equivalent school-wide SELECT policy for `profiles` itself
-- after dropping the old recursive one. Since then, the only SELECT policy
-- on profiles has been "see your own row" (profiles_user_reads_own) - so
-- any query for a class roster, a school's user list, the friend/search
-- directory, etc. returns nothing for everyone except admins querying with
-- the service role.
--
-- Fix: add a non-recursive, school-scoped SELECT policy using the same safe
-- pattern as migration 002 - reading school_id straight from the JWT's
-- user_metadata instead of subquerying profiles (which is what caused the
-- original recursion).

DROP POLICY IF EXISTS "profiles_school_reads_all" ON profiles;

CREATE POLICY "profiles_school_reads_all" ON profiles FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);