-- Adds cover image and ISBN columns for the new "Add book" flow, plus the
-- missing INSERT/DELETE policies for library_books (previously only had
-- read + update, so librarians could never actually add books).

ALTER TABLE library_books ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS isbn TEXT;

CREATE POLICY "books_librarian_insert" ON library_books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()
    AND (role = 'teacher' OR role = 'admin' OR is_librarian = true)
    AND school_id = library_books.school_id)
);

CREATE POLICY "books_librarian_delete" ON library_books FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()
    AND (role = 'teacher' OR role = 'admin' OR is_librarian = true)
    AND school_id = library_books.school_id)
);
