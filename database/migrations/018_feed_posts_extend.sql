-- School feed posts: author + audience + admin management.
--
-- audience: 'everyone' (default) | 'students' | 'teachers' - filtered in RLS
-- so a student can never read a teachers-only post by guessing IDs.
-- image_path points into the private "feed" bucket (signed URLs at render).

ALTER TABLE school_feed_posts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE school_feed_posts ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'everyone'
  CHECK (audience IN ('everyone', 'students', 'teachers'));
ALTER TABLE school_feed_posts ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE school_feed_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_school_feed_audience ON school_feed_posts(audience, created_at DESC);

DROP POLICY IF EXISTS "feed_posts_school_read" ON school_feed_posts;
DROP POLICY IF EXISTS "feed_posts_admin_write" ON school_feed_posts;

-- School-wide read, filtered by audience vs the caller's role.
CREATE POLICY "feed_posts_school_read" ON school_feed_posts FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
  AND (
    audience = 'everyone'
    OR (
      audience = 'students'
      AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'student')
    )
    OR (
      audience = 'teachers'
      AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('teacher', 'admin'))
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  )
);

CREATE POLICY "feed_posts_admin_create" ON school_feed_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = school_feed_posts.school_id)
  AND author_id = (SELECT id FROM profiles p WHERE p.user_id = auth.uid())
);
CREATE POLICY "feed_posts_admin_update" ON school_feed_posts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = school_feed_posts.school_id)
);
CREATE POLICY "feed_posts_admin_delete" ON school_feed_posts FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = school_feed_posts.school_id)
);

-- ---------------------------------------------------------------------------
-- Storage: private "feed" bucket for post images. Admin write, school read.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('feed', 'feed', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "feed_school_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'feed'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.school_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "feed_admin_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'feed'
  AND EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id::text = (storage.foldername(name))[1])
);
CREATE POLICY "feed_admin_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'feed'
  AND EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id::text = (storage.foldername(name))[1])
);
