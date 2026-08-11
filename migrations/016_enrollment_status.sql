-- Enrollment status ("ENROLLED" badge).
--
-- Independent of course_enrollments: this is the admin-controlled standing a
-- student has for a school year/semester. It is deliberately NOT tied to any
-- payment verification (there is none yet) - the expiry/renewal mechanics are
-- ready for a future payment integration to drive.
--
-- Effective status is computed at read time (expires_at < now() => expired),
-- so a status automatically lapses without any background job.

CREATE TABLE IF NOT EXISTS enrollment_status (
  student_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'revoked')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enrollment_status_school ON enrollment_status(school_id);

ALTER TABLE enrollment_status ENABLE ROW LEVEL SECURITY;

-- Students read their own; admins read/manage the whole school. Teachers do
-- not need enrollment data.
CREATE POLICY "enrollment_status_own_read" ON enrollment_status FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "enrollment_status_admin_read" ON enrollment_status FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = enrollment_status.school_id)
);
CREATE POLICY "enrollment_status_admin_write" ON enrollment_status FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = enrollment_status.school_id)
);

-- Helper: effective status for a student as seen by the caller.
-- Returns NULL when there is no record (unknown), 'expired' when the expiry
-- date has passed, otherwise the stored status.
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
  IF caller_role = 'admin' AND caller_school IS NOT DISTINCT FROM student_school THEN
    -- admins may read the full record
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

-- Auto-expire in bulk for reporting: flips nothing (status is computed), but
-- future integrations can call this to harden rows if desired.
CREATE OR REPLACE FUNCTION public.refresh_expired_enrollments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE enrollment_status
  SET status = 'revoked', updated_at = now()
  WHERE status = 'enrolled' AND expires_at IS NOT NULL AND expires_at < now();
END;
$$;
