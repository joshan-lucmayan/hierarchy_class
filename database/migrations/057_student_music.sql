-- Student music posts (post by link, metadata resolved from the platform).
--
-- Mirrors the student_achievements ownership/visibility model: students post
-- music to their own profile by providing a music URL; the application
-- resolves title/artist/cover server-side (keyless oEmbed for YouTube,
-- SoundCloud and Vimeo, keyless iTunes lookup for Apple Music, Spotify via
-- keyless oEmbed with an optional Web API upgrade when server-only env vars
-- are configured) and stores the resolved metadata plus the original
-- external link. The profile only ever links out to the platform - no audio
-- is stored or re-hosted.

CREATE TABLE IF NOT EXISTS student_music (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  music_url TEXT NOT NULL,       -- the original external music link
  platform TEXT NOT NULL,        -- youtube | soundcloud | vimeo | spotify | apple
  title TEXT NOT NULL,           -- resolved song title
  artist TEXT NOT NULL,          -- resolved artist / band
  album_cover_url TEXT,          -- resolved album artwork (nullable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_music_student ON student_music(student_id, created_at DESC);

ALTER TABLE student_music ENABLE ROW LEVEL SECURITY;

-- Same-school read: any authenticated user in the school can view the music
-- on a student's profile (mirrors profiles_school_reads_all).
CREATE POLICY "music_school_read" ON student_music FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);

-- Owner create: the student_id must be the authenticated user's own profile.
CREATE POLICY "music_own_insert" ON student_music FOR INSERT WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Owner delete only.
CREATE POLICY "music_own_delete" ON student_music FOR DELETE USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
