DROP POLICY IF EXISTS "materials_school_read" ON learning_materials;
DROP POLICY IF EXISTS "books_school_read" ON library_books;
DROP POLICY IF EXISTS "quizzes_school_read" ON quizzes;
DROP POLICY IF EXISTS "feed_posts_school_read" ON school_feed_posts;
DROP POLICY IF EXISTS "banner_school_read" ON banner_config;

CREATE POLICY "materials_school_read" ON learning_materials FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);

CREATE POLICY "books_school_read" ON library_books FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);

CREATE POLICY "quizzes_school_read" ON quizzes FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);

CREATE POLICY "feed_posts_school_read" ON school_feed_posts FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);

CREATE POLICY "banner_school_read" ON banner_config FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);