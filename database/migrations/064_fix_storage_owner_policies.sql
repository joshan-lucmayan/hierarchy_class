-- ===========================================================================
-- 064: FIX storage owner policies — folder 2 is the PROFILE id, not auth.uid().
--
-- Every client upload path (stories `myday`, feedback attachments) builds
-- the object path as `{school_id}/{profile.id}/{uuid}.ext` — folder 2 is the
-- caller's PROFILES row id. But the owner policies (060 for `feedback`,
-- and the pre-existing `myday` policies) compared folder 2 against
-- `auth.uid()` (the AUTH USERS id). Since migration 059 fixed the old
-- `profiles.id = auth.uid()` bug, the two ids have been different, so:
--
--   * feedback attachment uploads (v1.7.66) always failed with RLS 42501
--     ("new row violates row-level security policy")
--   * story image uploads have been broken since 059 was applied
--
-- Fix: compare folder 2 to the caller's own profile id resolved from the
-- profiles table (database truth, same pattern as the read policies which
-- key folder 1 on the caller's school). Owner = the logged-in user's own
-- profile row; nothing else changes. Admin read policies (school-keyed)
-- were already correct.
--
-- Idempotent (DROP POLICY IF EXISTS + CREATE POLICY). Applied AFTER 063.
-- ===========================================================================

-- ---- feedback bucket ----
DROP POLICY IF EXISTS "feedback_owner_write" ON storage.objects;
CREATE POLICY "feedback_owner_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'feedback'
  AND (storage.foldername(name))[2] =
      (SELECT id::text FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "feedback_owner_update" ON storage.objects;
CREATE POLICY "feedback_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'feedback'
  AND (storage.foldername(name))[2] =
      (SELECT id::text FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "feedback_owner_delete" ON storage.objects;
CREATE POLICY "feedback_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'feedback'
  AND (storage.foldername(name))[2] =
      (SELECT id::text FROM profiles WHERE user_id = auth.uid())
);

-- ---- myday bucket (pre-existing breakage, same fix) ----
DROP POLICY IF EXISTS "myday_owner_write" ON storage.objects;
CREATE POLICY "myday_owner_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'myday'
  AND (storage.foldername(name))[2] =
      (SELECT id::text FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "myday_owner_update" ON storage.objects;
CREATE POLICY "myday_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'myday'
  AND (storage.foldername(name))[2] =
      (SELECT id::text FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "myday_owner_delete" ON storage.objects;
CREATE POLICY "myday_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'myday'
  AND (storage.foldername(name))[2] =
      (SELECT id::text FROM profiles WHERE user_id = auth.uid())
);
