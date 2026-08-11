-- Private "banners" bucket for admin-uploaded header banners.
-- Paths: {school_id}/{auth_uid}/{uuid}. Signed URLs at render.

INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "banners_school_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'banners'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.school_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "banners_admin_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'banners'
  AND EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id::text = (storage.foldername(name))[1])
);
CREATE POLICY "banners_admin_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'banners'
  AND EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id::text = (storage.foldername(name))[1])
);
