-- ===========================================================================
-- 063: FIX send_chat_message — 060 rewrote it against a schema that does not
-- exist, breaking ALL message sending in production.
--
-- The live `conversations` table (migration 025, thread rewrite) uses ONE
-- row per participant pair: user_a_id / user_b_id (plus per-side
-- read_at_a/read_at_b, archived_a/archived_b, deleted_a/deleted_b). The 060
-- version referenced `participant_id` / `other_user_id` (a much older
-- two-rows-per-conversation model) and `deleted_at`/`archived_at`, so every
-- call failed with `column "other_user_id" does not exist` (42703) — sending
-- a message was completely broken.
--
-- This restores the correct 025-era logic (real columns, other side revived
-- from archive but their deleted_at/history-cutoff untouched, block-aware)
-- and KEEPS the v1.7.66 improvement: an in-app notification for the
-- recipient with a link straight into the thread
-- (`/student|teacher|admin/messages?with=<sender profile id>`, which
-- MessengerView already resolves to the exact conversation), skipped when
-- the recipient read the thread within the last 2 minutes.
--
-- Idempotent (CREATE OR REPLACE FUNCTION). Applied AFTER 060/061/062.
-- ===========================================================================

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
  conv conversations%ROWTYPE;
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

  SELECT id, full_name INTO me, my_name FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO conv FROM conversations WHERE id = p_conversation_id;
  IF conv.id IS NULL OR (conv.user_a_id <> me AND conv.user_b_id <> me) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;
  other_participant := CASE WHEN conv.user_a_id = me THEN conv.user_b_id ELSE conv.user_a_id END;

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

  -- Bump the preview and revive the OTHER side from archive (a fresh message
  -- means the thread is active again) - but never touch their deleted_at,
  -- which is their history cutoff.
  IF conv.user_a_id = me THEN
    UPDATE conversations
    SET last_message = trim(p_text), last_message_at = now(), archived_b = NULL
    WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations
    SET last_message = trim(p_text), last_message_at = now(), archived_a = NULL
    WHERE id = p_conversation_id;
  END IF;

  -- Notify the recipient with a link straight into the thread, unless they
  -- are actively reading it (read within the last 2 minutes).
  SELECT role INTO other_role FROM profiles WHERE id = other_participant;
  recently_read := CASE
    WHEN conv.user_a_id = other_participant
      THEN conv.read_at_a > now() - interval '2 minutes'
    ELSE conv.read_at_b > now() - interval '2 minutes'
  END;

  other_messages_path := CASE other_role
    WHEN 'teacher' THEN '/teacher/messages'
    WHEN 'admin' THEN '/admin/messages'
    ELSE '/student/messages'
  END;

  IF NOT COALESCE(recently_read, false) THEN
    INSERT INTO notifications (school_id, recipient_id, actor_id, type, title, body, link)
    VALUES (conv.school_id, other_participant, me, 'message', my_name, trim(p_text),
            other_messages_path || '?with=' || me);
  END IF;

  RETURN new_id;
END;
$$;
