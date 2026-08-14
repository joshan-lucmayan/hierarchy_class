-- Migration 003's signup trigger inserted '{}' for tags/hobbies/interests.
-- For a JSONB column, '{}' is an empty OBJECT, not an empty array - so
-- every profile created since then has these fields as {} instead of [],
-- which breaks any frontend code calling .join()/.map() on them.

-- 1. Backfill existing rows that got the wrong shape.
UPDATE profiles SET tags = '[]' WHERE tags = '{}'::jsonb;
UPDATE profiles SET hobbies = '[]' WHERE hobbies = '{}'::jsonb;
UPDATE profiles SET interests = '[]' WHERE interests = '{}'::jsonb;

-- 2. Fix the trigger itself so new signups don't repeat this.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id UUID;
  meta_role TEXT;
  meta_name TEXT;
  meta_school_id UUID;
  meta_is_librarian BOOLEAN;
  first_initial TEXT;
  second_initial TEXT;
BEGIN
  meta_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  meta_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  meta_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  meta_is_librarian := COALESCE((NEW.raw_user_meta_data->>'is_librarian')::boolean, false);

  first_initial := COALESCE(UPPER(LEFT(split_part(meta_name, ' ', 1), 1)), '');
  second_initial := COALESCE(UPPER(LEFT(split_part(meta_name, ' ', 2), 1)), '');

  INSERT INTO public.profiles (
    user_id,
    school_id,
    role,
    full_name,
    initials,
    overall_rank,
    academic_excellence,
    is_librarian,
    tags,
    hobbies,
    interests
  )
  VALUES (
    NEW.id,
    meta_school_id,
    meta_role,
    meta_name,
    first_initial || second_initial,
    'B',
    50,
    meta_is_librarian,
    '[]',
    '[]',
    '[]'
  )
  RETURNING id INTO new_profile_id;

  IF meta_role = 'student' THEN
    INSERT INTO public.florin_balances (student_id, balance)
    VALUES (new_profile_id, 0);
  END IF;

  RETURN NEW;
END;
$$;
