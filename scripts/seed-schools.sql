-- Seed script for schools table
-- Path: Supabase Dashboard > SQL Editor > New Query > Paste + Execute
--
-- The platform currently operates for a single institution: CSA.

INSERT INTO schools (name, abbreviation, active) VALUES
  ('CSA - College of Saint Amateil', 'CSA', true)
ON CONFLICT (name) DO NOTHING;

-- Verify seed was successful
SELECT id, name, abbreviation FROM schools ORDER BY created_at;
