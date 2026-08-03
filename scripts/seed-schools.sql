-- Seed script for schools table
-- Paste this into Supabase SQL Editor to populate initial schools
-- Path: Supabase Dashboard > SQL Editor > New Query > Paste + Execute

INSERT INTO schools (name, abbreviation, active) VALUES
  ('CSA - College of Saint Amateil', 'CSA', true),
  ('SVS - St. Vincent School', 'SVS', true),
  ('HNA - Holy Name Academy', 'HNA', true),
  ('GIS - Greenfield Integrated School', 'GIS', true),
  ('MVS - Mount Vernon School', 'MVS', true)
ON CONFLICT (name) DO NOTHING;

-- Verify seed was successful
SELECT id, name, abbreviation FROM schools ORDER BY created_at;
