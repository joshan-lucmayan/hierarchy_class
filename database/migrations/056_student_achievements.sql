-- Student achievements + certificate storage.
--
-- Students post achievements to their own profile: four text/date fields plus
-- a raw certificate image. The image lives in the public "certificates"
-- bucket (same ownership pattern as avatars: folder = auth user id, owner
-- write/delete, everyone reads). The table follows the stories/profiles
-- ownership model: RLS derives ownership from the authenticated user's own
-- profile row; reads are school-scoped like profiles_school_reads_all.

CREATE TABLE IF NOT EXISTS student_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  school_year TEXT NOT NULL,
  date_awarded DATE NOT NULL,
  school TEXT NOT NULL,
  image_path TEXT NOT NULL, -- public URL of the raw certificate in the certificates bucket
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_achievements_student ON student_achievements(student_id, date_awarded DESC);

ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

-- Same-school read: any authenticated user in the school can view the
-- achievements on a student's profile (mirrors profiles_school_reads_all).
CREATE POLICY "achievements_school_read" ON student_achievements FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);

-- Owner create: the student_id must be the authenticated user's own profile.
CREATE POLICY "achievements_own_insert" ON student_achievements FOR INSERT WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Owner delete only (no update in this feature). Deleting an achievement also
-- removes its certificate object from storage (handled in the client hook).
CREATE POLICY "achievements_own_delete" ON student_achievements FOR DELETE USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Dedicated public bucket for raw certificate images, mirroring the avatars
-- pattern: public read, owner folder write/delete, no global write.
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "certificates_public_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'certificates'
);

CREATE POLICY "certificates_owner_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "certificates_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text
);
