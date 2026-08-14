-- 1) Grade entry approval workflow + hardened grade visibility.
--
-- Teachers submit grades as 'pending'; admins approve/reject; students only
-- ever see their OWN approved grades (previously every student could read the
-- whole school's grades - fixed here). Teachers see rows for the courses they
-- teach; admins see the whole school.

ALTER TABLE grade_entries ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Grandfather existing rows: only NEW teacher submissions start as 'pending'.
UPDATE grade_entries SET approval_status = 'approved' WHERE approval_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_grade_entries_approval ON grade_entries(approval_status, created_at DESC);

DROP POLICY IF EXISTS "grade_entries_school_read" ON grade_entries;

CREATE POLICY "grade_entries_student_read_own" ON grade_entries FOR SELECT USING (
  approval_status = 'approved'
  AND student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "grade_entries_teacher_read_own" ON grade_entries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'teacher'
    AND EXISTS (SELECT 1 FROM courses c WHERE c.id = grade_entries.course_id AND c.teacher_id = p.id)
  )
);
CREATE POLICY "grade_entries_admin_read" ON grade_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = grade_entries.school_id)
);

-- Admins approve/reject and may delete any entry in their school.
CREATE POLICY "grade_entries_admin_update" ON grade_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = grade_entries.school_id)
);
CREATE POLICY "grade_entries_admin_delete" ON grade_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = grade_entries.school_id)
);

-- ---------------------------------------------------------------------------
-- 2) Account requests (deactivation / deletion) for admin review.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deactivation', 'deletion')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_account_requests_school ON account_requests(school_id, status);

ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_requests_own_read" ON account_requests FOR SELECT USING (
  requester_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "account_requests_admin_read" ON account_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = account_requests.school_id)
);
CREATE POLICY "account_requests_own_create" ON account_requests FOR INSERT WITH CHECK (
  requester_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "account_requests_admin_update" ON account_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id = account_requests.school_id)
);
