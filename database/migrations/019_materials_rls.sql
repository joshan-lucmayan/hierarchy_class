-- Learning materials: teachers manage their own uploads; admins manage all.
-- Reads stay school-wide (that is the product's authorization model - any
-- user at the school may browse materials).

DROP POLICY IF EXISTS "materials_teacher_write" ON learning_materials;

CREATE POLICY "materials_teacher_create" ON learning_materials FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'teacher'
    AND p.school_id = learning_materials.school_id)
  AND uploaded_by = (SELECT id FROM profiles p WHERE p.user_id = auth.uid())
);
CREATE POLICY "materials_owner_update" ON learning_materials FOR UPDATE USING (
  uploaded_by = (SELECT id FROM profiles p WHERE p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = learning_materials.school_id)
);
CREATE POLICY "materials_owner_delete" ON learning_materials FOR DELETE USING (
  uploaded_by = (SELECT id FROM profiles p WHERE p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = learning_materials.school_id)
);

-- ---------------------------------------------------------------------------
-- Storage: private "materials" bucket. Paths {school_id}/{auth_uid}/{uuid}.
-- Teacher/admin write, school-wide read (signed URLs at render).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "materials_school_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'materials'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.school_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "materials_teacher_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'materials'
  AND EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role IN ('teacher', 'admin')
    AND p.school_id::text = (storage.foldername(name))[1])
);
CREATE POLICY "materials_teacher_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'materials'
  AND EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role IN ('teacher', 'admin')
    AND p.school_id::text = (storage.foldername(name))[1])
);
CREATE POLICY "materials_teacher_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'materials'
  AND EXISTS (SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role IN ('teacher', 'admin')
    AND p.school_id::text = (storage.foldername(name))[1])
);
