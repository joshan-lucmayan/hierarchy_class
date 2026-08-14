-- 032: Education Level → Program → Year/Level → Course.
--
-- `programs` gains a self-referencing `parent_id` so a top-level row is an
-- EDUCATION LEVEL (e.g. "College") and rows with a parent are the PROGRAMS
-- inside it (e.g. "DIT"). Sections (year/level) keep pointing at their
-- program, so nothing below this level moves.

ALTER TABLE programs ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES programs(id) ON DELETE CASCADE;

-- Data migration (idempotent): if a top-level education level named "College"
-- exists and there are parentless programs named like "DIT", nest them under
-- it. Running this twice is a no-op because of the `parent_id IS NULL` guard.
UPDATE programs AS child
SET parent_id = (
  SELECT id FROM programs
  WHERE name ILIKE 'college%' AND parent_id IS NULL
  LIMIT 1
)
WHERE child.parent_id IS NULL
  AND child.name ILIKE 'dit%'
  AND EXISTS (SELECT 1 FROM programs WHERE name ILIKE 'college%' AND parent_id IS NULL);

-- Index for the parent lookup used by the hierarchy pages.
CREATE INDEX IF NOT EXISTS idx_programs_parent ON programs(parent_id);
