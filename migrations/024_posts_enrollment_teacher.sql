-- 1) School feed: separate social-style posts from text-only announcements.
--    'post' = Facebook-style feed item (text first, optional title/image).
--    'announcement' = important school notice (text only, triggers the
--    notification fan-out). Default is 'post' so pre-existing rows become
--    feed posts.
ALTER TABLE school_feed_posts ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'post'
  CHECK (post_type IN ('post', 'announcement'));
CREATE INDEX IF NOT EXISTS idx_school_feed_type ON school_feed_posts(post_type, created_at DESC);

-- 2) Teachers need to see whether a student is currently enrolled (the
--    verified-style badge on rosters and student views). Students still only
--    ever see their own row; admins keep full management access.
DROP POLICY IF EXISTS "enrollment_status_teacher_read" ON enrollment_status;
CREATE POLICY "enrollment_status_teacher_read" ON enrollment_status FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'teacher'
      AND p.school_id = enrollment_status.school_id
  )
);

-- Extend the effective-status helper so teachers (like admins) can look up
-- a student's effective status. Reads are still governed by the RLS policies
-- above; this just widens the caller check.
CREATE OR REPLACE FUNCTION public.effective_enrollment_status(p_student_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  row enrollment_status%ROWTYPE;
  caller_role TEXT;
  caller_school UUID;
  student_school UUID;
BEGIN
  SELECT role, school_id INTO caller_role, caller_school FROM profiles WHERE user_id = auth.uid();
  SELECT school_id INTO student_school FROM profiles WHERE id = p_student_id;
  IF caller_role IN ('admin', 'teacher') AND caller_school IS NOT DISTINCT FROM student_school THEN
    -- staff may read the full record for students in their school
  ELSIF p_student_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) THEN
    -- students may read their own
  ELSE
    RETURN NULL;
  END IF;

  SELECT * INTO row FROM enrollment_status WHERE student_id = p_student_id;
  IF row.student_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF row.status = 'revoked' THEN
    RETURN 'revoked';
  END IF;
  IF row.expires_at IS NOT NULL AND row.expires_at < now() THEN
    RETURN 'expired';
  END IF;
  RETURN row.status;
END;
$$;
