-- ===========================================================================
-- 060: v1.7.66 hardening - account restriction & appeals, feedback
--      attachments, actionable message notifications.
--
-- Applied AFTER 059 (already live). Never touches CSA data, the school set,
-- or the authorization model:
--
--   1) profiles.restricted_at - a NEW lifecycle state, deliberately separate
--      from deactivated_at. Deactivation stays self-service (a user can
--      reactivate themselves). Restriction is a controlled school-admin
--      action for suspicious accounts: the user can still authenticate, but
--      the middleware routes them to /auth/restricted where they can appeal.
--      RLS (profiles_admin_update from 059) already limits WHO can set it:
--      a same-school admin, and never on an admin account.
--
--   2) account_appeals - the appeal queue. Users write their own row while
--      restricted (one open appeal per user, enforced by a partial unique
--      index); same-school admins read and resolve appeals.
--
--   3) feedback_reports + the private "feedback" bucket - report
--      attachments are uploaded by the authenticated reporter into a
--      school/user folder and referenced from a feedback row that only
--      same-school admins (and developers) can read.
--
--   4) send_chat_message now emits an in-app notification with a link to the
--      exact conversation (role-appropriate messages route + ?with= sender),
--      so "New message" notifications actually open the thread. The old
--      client-side notification used a broken "/messages" link.
--
-- All statements are idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE FUNCTION) and safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) profiles.restricted_at
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_restricted ON profiles (school_id) WHERE restricted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) account_appeals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One OPEN appeal per user at a time (a resolved appeal can be re-appealed).
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_appeals_one_open_per_user
  ON account_appeals (user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_account_appeals_school ON account_appeals (school_id, status, created_at DESC);

ALTER TABLE account_appeals ENABLE ROW LEVEL SECURITY;

-- Users: create their own appeal while their account is restricted.
DROP POLICY IF EXISTS "appeals_own_create" ON account_appeals;
CREATE POLICY "appeals_own_create" ON account_appeals FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_id AND p.restricted_at IS NOT NULL
  )
);

-- Users: read their own appeals (so the restriction page can show status).
DROP POLICY IF EXISTS "appeals_own_read" ON account_appeals;
CREATE POLICY "appeals_own_read" ON account_appeals FOR SELECT USING (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Admins: read and resolve appeals within their own school.
DROP POLICY IF EXISTS "appeals_admin_all" ON account_appeals;
CREATE POLICY "appeals_admin_all" ON account_appeals FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = account_appeals.school_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = account_appeals.school_id
  )
);

-- Publish appeals to realtime so the admin's queue updates live.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'account_appeals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.account_appeals;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Profile email read for admin emails (restriction notices)
--
-- auth.users.email is NOT readable through the anon key. This SECURITY
-- DEFINER function returns a user's email ONLY to a same-school admin
-- caller (used by the server action that emails restriction notices).
-- Returns NULL when the caller is not an authorized admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_email(p_profile_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM auth.users u
  WHERE u.id = (SELECT p.user_id FROM profiles p WHERE p.id = p_profile_id)
    AND EXISTS (
      SELECT 1
      FROM profiles caller
      JOIN profiles target ON target.id = p_profile_id
      WHERE caller.user_id = auth.uid()
        AND caller.role = 'admin'
        AND caller.school_id = target.school_id
    );
$$;

-- ---------------------------------------------------------------------------
-- 4) feedback_reports + feedback storage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  page TEXT,
  message TEXT NOT NULL CHECK (length(btrim(message)) > 0),
  attachment_paths TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_school ON feedback_reports (school_id, created_at DESC);

ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- Users: file a report for themselves at their own school.
DROP POLICY IF EXISTS "feedback_reports_own_create" ON feedback_reports;
CREATE POLICY "feedback_reports_own_create" ON feedback_reports FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
);

-- Users: read their own reports.
DROP POLICY IF EXISTS "feedback_reports_own_read" ON feedback_reports;
CREATE POLICY "feedback_reports_own_read" ON feedback_reports FOR SELECT USING (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Admins / developers: review reports from their own school.
DROP POLICY IF EXISTS "feedback_reports_admin_read" ON feedback_reports;
CREATE POLICY "feedback_reports_admin_read" ON feedback_reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin' AND p.school_id = feedback_reports.school_id
  )
);

-- Private "feedback" bucket. Paths: {school_id}/{user_id}/{uuid}.ext so
-- school scoping (folder 1) and ownership (folder 2) are enforced entirely
-- by storage policies, same pattern as the "myday" bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback', 'feedback', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "feedback_owner_write" ON storage.objects;
CREATE POLICY "feedback_owner_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'feedback' AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "feedback_owner_update" ON storage.objects;
CREATE POLICY "feedback_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'feedback' AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "feedback_owner_delete" ON storage.objects;
CREATE POLICY "feedback_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'feedback' AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Admins of the school can read/review attachments (folder 1 = school id).
DROP POLICY IF EXISTS "feedback_admin_read" ON storage.objects;
CREATE POLICY "feedback_admin_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'feedback'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
    AND p.school_id::text = (storage.foldername(name))[1]
  )
);

-- ---------------------------------------------------------------------------
-- 5) Actionable message notifications
--
-- send_chat_message now creates an in-app notification for the other
-- participant with a link straight to their conversation (role-appropriate
-- messages route + ?with=<sender profile id>). To avoid notification spam
-- while someone is actively reading the thread, the notification is skipped
-- when the recipient read that conversation within the last 2 minutes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_chat_message(p_conversation_id UUID, p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
  my_name TEXT;
  my_role TEXT;
  new_id UUID;
  other_participant UUID;
  other_role TEXT;
  other_messages_path TEXT;
  recently_read BOOLEAN;
BEGIN
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RAISE EXCEPTION 'Message is empty';
  END IF;
  IF length(p_text) > 2000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;

  SELECT id, full_name, role INTO me, my_name, my_role FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT other_user_id INTO other_participant
  FROM conversations
  WHERE id = p_conversation_id AND participant_id = me;
  IF other_participant IS NULL THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  -- The other participant may have blocked me, or I may have blocked them.
  IF EXISTS (
    SELECT 1 FROM chat_blocks
    WHERE (blocker_id = me AND blocked_id = other_participant)
       OR (blocker_id = other_participant AND blocked_id = me)
  ) THEN
    RAISE EXCEPTION 'Messaging is blocked with this user';
  END IF;

  INSERT INTO chat_messages (conversation_id, from_id, from_name, text)
  VALUES (p_conversation_id, me, my_name, trim(p_text))
  RETURNING id INTO new_id;

  -- My row: bump last_message.
  UPDATE conversations
  SET last_message = trim(p_text), last_message_at = now()
  WHERE id = p_conversation_id;

  -- The other participant's row: bump last_message and bring the thread back
  -- if they had archived or hidden it - a fresh message means it's active.
  UPDATE conversations
  SET last_message = trim(p_text),
      last_message_at = now(),
      deleted_at = NULL,
      archived_at = NULL
  WHERE participant_id = other_participant AND other_user_id = me;

  -- Notify the recipient with a link straight into the thread, unless they
  -- are actively reading it (read within the last 2 minutes).
  SELECT role INTO other_role FROM profiles WHERE id = other_participant;
  SELECT (last_read_at > now() - interval '2 minutes')
  INTO recently_read
  FROM conversations
  WHERE participant_id = other_participant AND other_user_id = me;

  other_messages_path := CASE other_role
    WHEN 'teacher' THEN '/teacher/messages'
    WHEN 'admin' THEN '/admin/messages'
    ELSE '/student/messages'
  END;

  IF NOT COALESCE(recently_read, false) THEN
    INSERT INTO notifications (school_id, recipient_id, actor_id, type, title, body, link)
    SELECT c.school_id, other_participant, me, 'message', my_name, trim(p_text),
           other_messages_path || '?with=' || me
    FROM conversations c
    WHERE c.id = p_conversation_id;
  END IF;

  RETURN new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
--   SELECT count(*) FROM profiles WHERE restricted_at IS NOT NULL;   -- 0
--   SELECT count(*) FROM account_appeals;                            -- 0
--   SELECT count(*) FROM feedback_reports;                           -- 0
--   SELECT id FROM storage.buckets WHERE id = 'feedback';            -- 1 row
--   \df get_profile_email
-- ---------------------------------------------------------------------------
