-- Adds avatar support to profiles and sets up a public Storage bucket for
-- profile pictures, scoped so a user can only write to their own folder.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatar_public_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'avatars'
);

CREATE POLICY "avatar_owner_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatar_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatar_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
