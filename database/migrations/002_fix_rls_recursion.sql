-- Migration 002: Fix RLS recursion on profiles table
-- Issue: SELECT policies on profiles that read from profiles caused infinite recursion
-- Solution: Remove recursive SELECT policies and use auth.user_metadata.school_id for school-level filtering

-- Drop the recursive policies on profiles table
DROP POLICY IF EXISTS "profiles_school_sees_all" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_writes" ON profiles;

-- Drop and recreate school-level policies for other tables to use auth.user_metadata instead of reading from profiles
DROP POLICY IF EXISTS "materials_school_read" ON learning_materials;
DROP POLICY IF EXISTS "books_school_read" ON library_books;
DROP POLICY IF EXISTS "quizzes_school_read" ON quizzes;
DROP POLICY IF EXISTS "feed_posts_school_read" ON school_feed_posts;
DROP POLICY IF EXISTS "banner_school_read" ON banner_config;

-- Recreate school-level read policies using auth.user_metadata.school_id (non-recursive)
CREATE POLICY "materials_school_read" ON learning_materials FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);

CREATE POLICY "books_school_read" ON library_books FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);

CREATE POLICY "quizzes_school_read" ON quizzes FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);

CREATE POLICY "feed_posts_school_read" ON school_feed_posts FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);

CREATE POLICY "banner_school_read" ON banner_config FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);
