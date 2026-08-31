-- ===========================================================================
-- 061: deactivation is SELF-SERVICE ONLY - close the raw-API path.
--
-- v1.7.66 removed the admin "Deactivate" button and the adminSetUserDeactivation
-- server action, but the DB still allowed a same-school admin to set another
-- user's deactivated_at through the REST API (profiles_admin_update matches
-- any non-admin profile, and protect_profile_columns did not guard the
-- lifecycle column). That contradicted the authority model: school admins
-- must NOT be able to deactivate users; the controlled action for suspicious
-- accounts is restricted_at (with the appeal flow).
--
-- Fix: protect_profile_columns now raises whenever a NON-service-role caller
-- sets or clears deactivated_at on a row that is not their own. Self-service
-- deactivation (Settings -> Deactivate account) and self-service reactivation
-- (/auth/reactivate) still work because those change the caller's OWN row.
-- The service-role provisioning/cleanup path remains exempt.
--
-- Idempotent: CREATE OR REPLACE FUNCTION. Applied AFTER 060 (already live).
-- Does not touch CSA data, schools, roles, or any other policy.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_role TEXT;
BEGIN
  -- Developer/platform-owner operations (service role, e.g. admin
  -- provisioning) are trusted and bypass these guards.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Deactivation is a self-service lifecycle state only. Nobody (including a
  -- school admin) may set OR clear another user's deactivated_at - the
  -- restricted_at state (plus the appeal flow) is the admin-controlled
  -- alternative for suspicious accounts.
  IF NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
     AND OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot deactivate another user; use restriction for suspicious accounts';
  END IF;

  SELECT role INTO caller_role FROM profiles WHERE user_id = auth.uid();

  -- restricted_at is an admin-controlled state: a non-admin may not set or
  -- clear it on themselves (self-restriction is meaningless - the admin
  -- workflow + appeal flow is the only intended path). Admin callers below
  -- are allowed to set/clear it on non-admin rows.
  IF caller_role IS DISTINCT FROM 'admin'
     AND NEW.restricted_at IS DISTINCT FROM OLD.restricted_at THEN
    RAISE EXCEPTION 'Cannot change restricted_at';
  END IF;

  IF caller_role = 'admin' THEN
    -- Admin rows are untouchable by school admins: no promotion, no
    -- demotion, and no change to the authorization fields (role, school_id,
    -- user_id). Only the service-role provisioning path may modify an admin.
    IF OLD.role = 'admin' AND (
         NEW.role IS DISTINCT FROM OLD.role
         OR NEW.school_id IS DISTINCT FROM OLD.school_id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
       ) THEN
      RAISE EXCEPTION 'Cannot modify an admin account';
    END IF;
    IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
      RAISE EXCEPTION 'Cannot change school_id';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot change user_id';
    END IF;
    IF NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Cannot promote a user to admin';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.academic_excellence IS DISTINCT FROM OLD.academic_excellence
     OR NEW.overall_rank IS DISTINCT FROM OLD.overall_rank
     OR NEW.is_librarian IS DISTINCT FROM OLD.is_librarian
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.faculty_id IS DISTINCT FROM OLD.faculty_id THEN
    RAISE EXCEPTION 'Cannot change protected profile fields';
  END IF;

  RETURN NEW;
END;
$function$;
