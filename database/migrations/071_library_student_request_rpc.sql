-- Student borrow request: students cannot UPDATE library_books directly (the
-- only UPDATE policy is books_teacher_update, which requires teacher/librarian
-- role).  This SECURITY DEFINER function atomically inserts the borrow request
-- AND flips the book to "requested", matching the codebase convention of using
-- SECURITY DEFINER for privileged cross-table operations.
--
-- The store's requestBorrow previously did two client-side writes:
--   1. INSERT INTO library_borrow_requests (OK, student can insert own)
--   2. UPDATE library_books SET status='requested' (BLOCKED by RLS)
-- Step 2 failed silently → book never showed as requested → student saw
-- nothing happen.  This function replaces both steps with a single RPC call.

CREATE OR REPLACE FUNCTION public.request_library_book(
  p_book_id UUID,
  p_days INT DEFAULT 7
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_school UUID;
  book_school UUID;
  book_status TEXT;
BEGIN
  -- Resolve caller from auth (not from arguments, so identity can't be forged).
  SELECT id, school_id INTO caller_id, caller_school
  FROM profiles WHERE user_id = auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate the book exists in the same school and is available.
  SELECT school_id, status INTO book_school, book_status
  FROM library_books WHERE id = p_book_id;
  IF book_school IS DISTINCT FROM caller_school THEN
    RAISE EXCEPTION 'Book is not in your school';
  END IF;
  IF book_status IS DISTINCT FROM 'available' THEN
    RAISE EXCEPTION 'Book is not available';
  END IF;

  -- Create the borrow request.
  INSERT INTO library_borrow_requests (school_id, book_id, student_id, status, requested_days)
  VALUES (caller_school, p_book_id, caller_id, 'pending', GREATEST(1, COALESCE(p_days, 7)));

  -- Mark the book as requested by the caller.
  UPDATE library_books
  SET status = 'requested',
      borrowed_by = caller_id,
      borrowed_by_name = (SELECT full_name FROM profiles WHERE id = caller_id)
  WHERE id = p_book_id;
END;
$$;

-- Revoke PUBLIC execute (Postgres defaults to granting PUBLIC EXECUTE on new
-- functions) and grant only to authenticated users.
REVOKE EXECUTE ON FUNCTION public.request_library_book(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_library_book(UUID, INT) TO authenticated;