-- Notifications + conversation read tracking.
--
-- notifications rows are only ever created through the SECURITY DEFINER
-- functions below (never directly from the client), so recipients can't be
-- forged by hand-editing an insert. Recipients can only read/mark their own.

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'system', -- announcement | message | task | grade | friend | system
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, read_at, created_at DESC);
CREATE INDEX idx_notifications_school ON notifications(school_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_recipient_read" ON notifications FOR SELECT USING (
  recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "notifications_recipient_update" ON notifications FOR UPDATE USING (
  recipient_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
-- No INSERT / DELETE policies: creation happens via the functions below and
-- deletion is intentionally not exposed to clients.

-- Create a notification for one recipient. The caller must be authenticated
-- and in the same school as the recipient.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
  caller_school_id UUID;
  recipient_school_id UUID;
BEGIN
  SELECT id, school_id INTO caller_profile_id, caller_school_id
  FROM profiles WHERE user_id = auth.uid();
  IF caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id INTO recipient_school_id FROM profiles WHERE id = p_recipient_id;
  IF recipient_school_id IS DISTINCT FROM caller_school_id THEN
    RAISE EXCEPTION 'Recipient is not in your school';
  END IF;

  INSERT INTO notifications (school_id, recipient_id, actor_id, type, title, body, link)
  VALUES (caller_school_id, p_recipient_id, caller_profile_id, p_type, p_title, p_body, p_link);
END;
$$;

-- Notify every admin in a school (used for grade submissions and other
-- teacher -> admin events).
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_school_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
  caller_school_id UUID;
BEGIN
  SELECT id, school_id INTO caller_profile_id, caller_school_id
  FROM profiles WHERE user_id = auth.uid();
  IF caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF caller_school_id IS DISTINCT FROM p_school_id THEN
    RAISE EXCEPTION 'Not your school';
  END IF;

  INSERT INTO notifications (school_id, recipient_id, actor_id, type, title, body, link)
  SELECT p_school_id, p.id, COALESCE(p_actor_id, caller_profile_id), p_type, p_title, p_body, NULL
  FROM profiles p
  WHERE p.school_id = p_school_id AND p.role = 'admin'
    AND p.id <> caller_profile_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Chat read tracking: conversations gain a last_read_at so the messenger can
-- show unread counts. Participants may update their own row only.
-- ---------------------------------------------------------------------------

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "conversations_participant_update" ON conversations;
CREATE POLICY "conversations_participant_update" ON conversations FOR UPDATE USING (
  participant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Create (or fetch) the two conversation rows for a sender/receiver pair.
-- Direct client inserts can't create the receiver's row under RLS, so this
-- SECURITY DEFINER helper does it for both sides in one call.
CREATE OR REPLACE FUNCTION public.ensure_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
  my_school UUID;
  other_school UUID;
  other_role TEXT;
  my_role TEXT;
  conv_id UUID;
BEGIN
  SELECT id, school_id, role INTO me, my_school, my_role
  FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT school_id, role INTO other_school, other_role
  FROM profiles WHERE id = p_other_user_id;
  IF other_school IS DISTINCT FROM my_school THEN
    RAISE EXCEPTION 'Not in your school';
  END IF;

  SELECT id INTO conv_id FROM conversations
  WHERE participant_id = me AND other_user_id = p_other_user_id
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (school_id, participant_id, other_user_id, role)
    VALUES (my_school, me, p_other_user_id, other_role);
    INSERT INTO conversations (school_id, participant_id, other_user_id, role)
    VALUES (my_school, p_other_user_id, me, my_role);
    SELECT id INTO conv_id FROM conversations
    WHERE participant_id = me AND other_user_id = p_other_user_id
    LIMIT 1;
  END IF;

  RETURN conv_id;
END;
$$;

-- Insert a chat message and update both sides' last_message in one call.
-- The message can only go into a conversation the caller participates in.
CREATE OR REPLACE FUNCTION public.send_chat_message(p_conversation_id UUID, p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
  my_name TEXT;
  new_id UUID;
BEGIN
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RAISE EXCEPTION 'Message is empty';
  END IF;
  IF length(p_text) > 2000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;

  SELECT id, full_name INTO me, my_name FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id AND participant_id = me
  ) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  INSERT INTO chat_messages (conversation_id, from_id, from_name, text)
  VALUES (p_conversation_id, me, my_name, trim(p_text))
  RETURNING id INTO new_id;

  UPDATE conversations
  SET last_message = trim(p_text)
  WHERE id = p_conversation_id;

  UPDATE conversations
  SET last_message = trim(p_text)
  WHERE other_user_id = me AND participant_id = (SELECT other_user_id FROM conversations WHERE id = p_conversation_id);

  RETURN new_id;
END;
$$;

-- Fan out an announcement notification to a post's audience. Admin only.
CREATE OR REPLACE FUNCTION public.notify_post_audience(p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
  caller_role TEXT;
  caller_school UUID;
  post_row school_feed_posts%ROWTYPE;
  target_role TEXT;
BEGIN
  SELECT id, role, school_id INTO caller_profile_id, caller_role, caller_school
  FROM profiles WHERE user_id = auth.uid();
  IF caller_profile_id IS NULL OR caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can publish announcements';
  END IF;

  SELECT * INTO post_row FROM school_feed_posts WHERE id = p_post_id;
  IF post_row.school_id IS DISTINCT FROM caller_school THEN
    RAISE EXCEPTION 'Post is not in your school';
  END IF;

  target_role := CASE post_row.audience
    WHEN 'students' THEN 'student'
    WHEN 'teachers' THEN 'teacher'
    ELSE NULL
  END;

  INSERT INTO notifications (school_id, recipient_id, actor_id, type, title, body, link)
  SELECT post_row.school_id, p.id, caller_profile_id, 'announcement', post_row.title, post_row.body, NULL
  FROM profiles p
  WHERE p.school_id = post_row.school_id
    AND (target_role IS NULL OR p.role = target_role)
    AND p.id <> caller_profile_id;
END;
$$;
