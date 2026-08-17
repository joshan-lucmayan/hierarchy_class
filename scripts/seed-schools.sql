-- Seed script for schools table
-- Path: Supabase Dashboard > SQL Editor > New Query > Paste + Execute
--
-- School registration is PLATFORM-OWNER controlled. CSA - College of Saint
-- Amateil is the sole registered school and is open for public signup
-- (registration_enabled = true). New schools are added ONLY by the platform
-- owner through this same controlled mechanism (INSERT a row here, then flip
-- registration_enabled to true when ready to accept signups).
--
-- Existing rows are untouched (ON CONFLICT (name) DO NOTHING) - re-running
-- this never duplicates CSA or changes its UUID.

INSERT INTO schools (name, abbreviation, active, registration_enabled) VALUES
  ('CSA - College of Saint Amateil', 'CSA', true, true)
ON CONFLICT (name) DO NOTHING;

-- Verify seed was successful
SELECT id, name, abbreviation, active, registration_enabled FROM schools ORDER BY created_at;
