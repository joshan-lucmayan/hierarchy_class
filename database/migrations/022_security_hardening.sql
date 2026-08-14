-- Security hardening pass.
--
-- 1) profiles: the generic "update own row" policy lets a student change
--    role / school / academic_excellence / overall_rank / is_librarian on
--    their own row. RLS can't compare old vs new values, so a BEFORE UPDATE
--    trigger blocks those columns for everyone except admins.
--
-- 2) friends: inserts must be same-school (no cross-institution friendships).
--
-- 3) chat_messages: direct client inserts must carry the caller's own
--    from_id (the SECURITY DEFINER send_chat_message is the sanctioned path
--    and is unaffected - it sets from_id itself).
--
-- 4) conversations: a direct insert must be your own participant row and
--    can't be self-to-self.
--
-- 5) florin: students could mint money via florin_transactions INSERT and
--    florin_balances UPDATE. No client-facing write policies remain; balances
--    only change through verified, server-side flows in the future.

-- 1) Profile column protection ------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE user_id = auth.uid();

  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.academic_excellence IS DISTINCT FROM OLD.academic_excellence
     OR NEW.overall_rank IS DISTINCT FROM OLD.overall_rank
     OR NEW.is_librarian IS DISTINCT FROM OLD.is_librarian THEN
    RAISE EXCEPTION 'Cannot change protected profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns ON profiles;
CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_columns();

-- 2) Friends must be same-school ----------------------------------------------
DROP POLICY IF EXISTS "friends_create_own" ON friends;
CREATE POLICY "friends_create_own" ON friends FOR INSERT WITH CHECK (
  user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles a
    JOIN profiles b ON b.id = user_b_id
    WHERE a.id = user_a_id AND a.user_id = auth.uid() AND a.school_id = b.school_id
  )
);

-- 3) Chat messages must be sent as yourself -----------------------------------
DROP POLICY IF EXISTS "chat_messages_participant_create" ON chat_messages;
CREATE POLICY "chat_messages_participant_create" ON chat_messages FOR INSERT WITH CHECK (
  from_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND conversation_id IN (
    SELECT id FROM conversations
    WHERE participant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- 4) Conversations: own participant row, no self-conversations ----------------
DROP POLICY IF EXISTS "conversations_participant_create" ON conversations;
CREATE POLICY "conversations_participant_create" ON conversations FOR INSERT WITH CHECK (
  participant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND other_user_id <> participant_id
);

-- 5) No client-side Florin minting --------------------------------------------
DROP POLICY IF EXISTS "florin_student_update_own" ON florin_balances;
DROP POLICY IF EXISTS "florin_trans_student_create" ON florin_transactions;

-- 6) Leaderboard aggregate view --------------------------------------------------
-- Students can no longer SELECT other students' grade_entries (hardened in
-- migration 020), but the leaderboard is a core product feature. This
-- SECURITY DEFINER function exposes ONLY per-student aggregates (average +
-- rank-relevant average, no individual entries) for the caller's own school,
-- so the leaderboard and profile cards keep working without leaking raw
-- grades. Ranks are computed client-side from the returned order.
CREATE OR REPLACE FUNCTION public.get_school_leaderboard()
RETURNS TABLE(
  student_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  level_label TEXT,
  section TEXT,
  academic_excellence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_school UUID;
BEGIN
  SELECT school_id INTO my_school FROM profiles WHERE user_id = auth.uid();
  IF my_school IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.level_label, p.section,
         CASE WHEN COUNT(ge.id) = 0 THEN NULL::numeric ELSE ROUND(AVG(ge.score)::numeric, 1) END
  FROM profiles p
  LEFT JOIN grade_entries ge ON ge.student_id = p.id AND ge.approval_status = 'approved'
  WHERE p.school_id = my_school AND p.role = 'student'
  GROUP BY p.id
  ORDER BY academic_excellence DESC NULLS LAST;
END;
$$;
