-- Fixes: "Failed to create profile: new row violates row-level security
-- policy for table 'profiles'" during signup.
--
-- Root cause: when email confirmation is enabled, auth.signUp() does not
-- establish a session immediately, so a client-side insert into `profiles`
-- runs with auth.uid() = null and fails the "profiles_user_inserts_own"
-- RLS check. Moving profile creation into a SECURITY DEFINER trigger on
-- auth.users sidesteps this - it runs at the database level the instant the
-- auth.users row is created, regardless of confirmation status.

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