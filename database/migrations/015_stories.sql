-- MyDay stories + story view tracking.
--
-- Stories are short-lived (24h by default) and school-scoped. The app only
-- ever queries rows with expires_at > now(), so expired stories stop
-- appearing without a cron job. A SECURITY DEFINER cleanup function is also
-- provided for removing fully-expired rows + their storage objects lazily.

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL, -- storage path in the private "myday" bucket
  caption TEXT,
  mention_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX idx_stories_school ON stories(school_id, expires_at DESC);
CREATE INDEX idx_stories_user ON stories(user_id);

-- One view per (story, viewer). Re-watching does not create duplicates.
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);
CREATE INDEX idx_story_views_story ON story_views(story_id);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Anyone in the school can read stories while they're active. Owners may
-- always read their own (even expired) so they can review viewer data.
CREATE POLICY "stories_school_read" ON stories FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
  AND (expires_at > now() OR user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "stories_own_create" ON stories FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "stories_own_delete" ON stories FOR DELETE USING (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = stories.school_id)
);

-- Story views: the viewer writes their own view; viewers see their own rows,
-- owners see who viewed their own stories. Nobody else can read viewer data.
CREATE POLICY "story_views_own_create" ON story_views FOR INSERT WITH CHECK (
  viewer_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "story_views_viewer_read" ON story_views FOR SELECT USING (
  viewer_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "story_views_owner_read" ON story_views FOR SELECT USING (
  story_id IN (SELECT id FROM stories WHERE user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- ---------------------------------------------------------------------------
-- Storage: private "myday" bucket. Paths are {school_id}/{auth_uid}/{uuid}.ext
-- so school scoping (folder 1) and ownership (folder 2) can be enforced
-- entirely by storage policies. URLs are always generated as signed URLs by
-- the client, never handed out as permanent public links.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('myday', 'myday', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "myday_school_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'myday'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.school_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "myday_owner_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'myday' AND (storage.foldername(name))[2] = auth.uid()::text
);
CREATE POLICY "myday_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'myday' AND (storage.foldername(name))[2] = auth.uid()::text
);
CREATE POLICY "myday_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'myday' AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Lazy cleanup: removes expired stories (and their storage objects). Called
-- from the client after a fetch; also safe to run from a scheduled job.
CREATE OR REPLACE FUNCTION public.cleanup_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired RECORD;
BEGIN
  FOR expired IN
    SELECT id, image_path, school_id, user_id FROM stories
    WHERE expires_at < now() - interval '7 days'
  LOOP
    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id = 'myday' AND name = expired.image_path;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- storage cleanup is best-effort
    END;
  END LOOP;

  DELETE FROM stories WHERE expires_at < now() - interval '7 days';
END;
$$;
