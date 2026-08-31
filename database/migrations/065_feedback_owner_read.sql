-- ===========================================================================
-- 065: feedback attachments - owner read (also required for owner deletes).
--
-- The feedback bucket had no owner SELECT policy: reporters could upload
-- (feedback_owner_write) but could not read their own attachment back, and
-- the Storage API's DELETE path reads the object first, so owner deletes
-- also failed with AccessDenied (verified during v1.7.66 production testing:
-- the myday delete worked because myday_school_read covers it; feedback
-- deletes did not). Orphaned uploads on a failed submit could never be
-- cleaned up by the reporter.
--
-- Add an owner-read policy scoped to the caller's own profile folder
-- (folder 2), mirroring the myday pattern. School-scoped admin read
-- (feedback_admin_read) is unchanged; other users still cannot see the
-- object. This enables retry/removal UX and lets the app delete attachments
-- a user chose to remove.
--
-- Idempotent. Applied AFTER 064.
-- ===========================================================================

DROP POLICY IF EXISTS "feedback_owner_read" ON storage.objects;
CREATE POLICY "feedback_owner_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'feedback'
  AND (storage.foldername(name))[2] =
      (SELECT id::text FROM profiles WHERE user_id = auth.uid())
);
