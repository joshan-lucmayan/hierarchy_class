-- library_borrow_log has been RLS-enabled (migration 001) with no policies.
-- Every client read/write is silently denied (0 rows):
--   - loadAll() reads the log for history/fines/receipts → empty (no data shown)
--   - approveRequest inserts "borrowed" rows → 0 rows (no log created)
--   - returnBook inserts "returned" rows with fine → 0 rows (fines not recorded)
-- Fix: add policies matching the library_borrow_requests pattern.

-- Students: see only their own borrow log entries (history tab).
DROP POLICY IF EXISTS "borrow_log_student_read" ON library_borrow_log;
CREATE POLICY "borrow_log_student_read" ON library_borrow_log FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Teachers / admins / librarians: see every log entry in the school.
DROP POLICY IF EXISTS "borrow_log_teacher_read" ON library_borrow_log;
CREATE POLICY "borrow_log_teacher_read" ON library_borrow_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid()
    AND (role = 'teacher' OR role = 'admin' OR is_librarian = true)
    AND school_id = library_borrow_log.school_id
  )
);

-- Teachers / admins / librarians: insert log rows (approve, return).
DROP POLICY IF EXISTS "borrow_log_teacher_insert" ON library_borrow_log;
CREATE POLICY "borrow_log_teacher_insert" ON library_borrow_log FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid()
    AND (role = 'teacher' OR role = 'admin' OR is_librarian = true)
    AND school_id = library_borrow_log.school_id
  )
);