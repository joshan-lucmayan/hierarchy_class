-- 033: profiles.program - store the student's PROGRAM (nested under an
-- education level) in the Academic info, alongside educational_level
-- (the top-level education level) and level_label (the grade/year section).
--
-- The education hierarchy on profiles is now:
--   educational_level  = top-level program (no parent), e.g. "College"
--   program            = nested program under it, e.g. "DIT"
--   level_label        = year/level section under the program, e.g. "Year 1"

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS program TEXT;
