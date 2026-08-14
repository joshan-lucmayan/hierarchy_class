-- 031: A fully-deleted thread must not keep showing a stale shared preview.
--
-- delete_conversation previously only stamped the caller's deleted_* cutoff.
-- The conversations table keeps ONE shared last_message/last_message_at for
-- both participants, so a thread could reappear in an inbox showing a
-- pre-delete message even though both users had deleted it.
--
-- Fix: once BOTH sides have deleted the thread, nobody needs the shared
-- preview anymore - clear it. A revived thread gets a fresh value from the
-- next send_chat_message, so the preview is always the genuinely newest
-- activity, never a stale survivor of the delete.

CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
  is_a BOOLEAN;
BEGIN
  SELECT id INTO me FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (user_a_id = me) INTO is_a FROM conversations WHERE id = p_conversation_id;
  IF is_a IS NULL THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  IF is_a THEN
    UPDATE conversations SET deleted_a = now() WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations SET deleted_b = now() WHERE id = p_conversation_id;
  END IF;

  -- Both participants have now deleted the thread: no one needs the shared
  -- preview anymore. Clearing it keeps a deleted thread from ever showing a
  -- stale "last message" in either inbox. (send_chat_message repopulates it
  -- the moment real new activity revives the thread.)
  UPDATE conversations
  SET last_message = NULL, last_message_at = NULL
  WHERE id = p_conversation_id
    AND deleted_a IS NOT NULL
    AND deleted_b IS NOT NULL;
END;
$$;
