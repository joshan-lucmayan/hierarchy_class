-- Split full_name into first_name / last_name.
--
-- The signup form now collects First Name + Last Name. Existing rows are
-- backfilled by splitting full_name on the first space (last name = the
-- remainder, so "Jane Marie Doe" keeps "Jane" + "Marie Doe" - better than
-- dropping the middle name). full_name stays as the display field and is
-- maintained by the trigger for new signups.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

UPDATE profiles
SET first_name = split_part(full_name, ' ', 1),
    last_name = CASE
      WHEN position(' ' in full_name) > 0
        THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE full_name
    END
WHERE first_name IS NULL OR last_name IS NULL;

-- Rebuild the signup trigger: it now reads first_name/last_name metadata
-- (with a `name` fallback for older flows) and persists all three fields.
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
  meta_first_name TEXT;
  meta_last_name TEXT;
  meta_school_id UUID;
  meta_is_librarian BOOLEAN;
  first_initial TEXT;
  second_initial TEXT;
BEGIN
  meta_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  meta_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  meta_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  meta_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');

  IF meta_first_name = '' AND meta_last_name = '' THEN
    -- Legacy flow: derive from the combined name.
    meta_first_name := split_part(meta_name, ' ', 1);
    meta_last_name := CASE
      WHEN position(' ' in meta_name) > 0 THEN substring(meta_name from position(' ' in meta_name) + 1)
      ELSE meta_name
    END;
  END IF;

  meta_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  meta_is_librarian := COALESCE((NEW.raw_user_meta_data->>'is_librarian')::boolean, false);

  first_initial := COALESCE(UPPER(LEFT(meta_first_name, 1)), '');
  second_initial := COALESCE(UPPER(LEFT(meta_last_name, 1)), '');

  INSERT INTO public.profiles (
    user_id,
    school_id,
    role,
    full_name,
    first_name,
    last_name,
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
    trim(meta_first_name || ' ' || meta_last_name),
    NULLIF(meta_first_name, ''),
    NULLIF(meta_last_name, ''),
    first_initial || second_initial,
    'B',
    50,
    meta_is_librarian,
    '{}',
    '{}',
    '{}'
  )
  RETURNING id INTO new_profile_id;

  IF meta_role = 'student' THEN
    INSERT INTO public.florin_balances (student_id, balance)
    VALUES (new_profile_id, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
