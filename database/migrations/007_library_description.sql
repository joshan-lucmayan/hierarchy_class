-- Add missing description column used by the library UI
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS description TEXT;
