-- Messaging overhaul + supporting fixes.
--
-- 1) Conversation duplicates: a race in ensure_conversation (two parallel
--    calls could both see "no conversation" and insert) created duplicate
--    rows for the same participant pair. Dedupe existing rows (reassigning
--    their messages to the kept row first), then enforce uniqueness so it
--    can never happen again.
-- 2) Per-user inbox state: archive / soft-delete live on each participant's
--    own row, so one user hiding a conversation never touches the other
--    user's copy or their messages.
-- 3) Blocks: chat_blocks with owner-only RLS; both send and conversation
--    creation refuse to operate across a block.
-- 4) Unread counts are computed from the database (last_read_at), so they
--    survive reloads.
-- 5) Grade approval: a SECURITY DEFINER RPC approves/rejects a submission
--    batch atomically and notifies the submitting teacher once.
-- 6) Admins may update student academic fields (level_label / section) -
--    protected fields are still guarded by the protect_profile_columns
--    trigger for non-admins.
-- 7) School feed posts: title becomes optional so text-first social posts
--    work.

-- 1) Dedupe conversations ---------------------------------------------------
-- Reassign messages from duplicate rows to the kept row. "Kept" = the
-- earliest-created row per participant pair (uuid has no min() aggregate,
-- so DISTINCT ON picks the winner by created_at instead).
WITH dupes AS (
  SELECT DISTINCT ON (participant_id, other_user_id)
         participant_id, other_user_id, id AS keep_id
  FROM conversations
  ORDER BY participant_id, other_user_id, created_at ASC, id ASC
)
UPDATE chat_messages m
SET conversation_id = d.keep_id
FROM conversations c
JOIN dupes d ON d.participant_id = c.participant_id AND d.other_user_id = c.other_user_id
WHERE m.conversation_id = c.id AND c.id <> d.keep_id;

WITH dupes AS (
  SELECT DISTINCT ON (participant_id, other_user_id)
         participant_id, other_user_id, id AS keep_id
  FROM conversations
  ORDER BY participant_id, other_user_id, created_at ASC, id ASC
)
DELETE FROM conversations c
USING dupes d
WHERE c.participant_id = d.participant_id AND c.other_user_id = d.other_user_id AND c.id <> d.keep_id;

-- Guarantee: one conversation per participant pair, ever.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_pair ON conversations (participant_id, other_user_id);

-- 2) Per-user inbox state -----------------------------------------------------
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- Backfill last_message_at from the newest message in each conversation.
UPDATE conversations c
SET last_message_at = (
  SELECT MAX(m.created_at) FROM chat_messages m WHERE m.conversation_id = c.id
)
WHERE last_message IS NOT NULL AND last_message_at IS NULL;

-- 3) Blocks ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocked ON chat_blocks(blocked_id);

ALTER TABLE chat_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_blocks_own_read" ON chat_blocks FOR SELECT USING (
  blocker_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR blocked_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "chat_blocks_own_insert" ON chat_blocks FOR INSERT WITH CHECK (
  blocker_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND blocker_id <> blocked_id
);
CREATE POLICY "chat_blocks_own_delete" ON chat_blocks FOR DELETE USING (
  blocker_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- 4) Rewritten ensure_conversation: race-free + block-aware --------------------
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
  IF p_other_user_id = me THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;

  -- Either direction of a block prevents a conversation.
  IF EXISTS (
    SELECT 1 FROM chat_blocks
    WHERE (blocker_id = me AND blocked_id = p_other_user_id)
       OR (blocker_id = p_other_user_id AND blocked_id = me)
  ) THEN
    RAISE EXCEPTION 'Messaging is blocked with this user';
  END IF;

  SELECT id INTO conv_id FROM conversations
  WHERE participant_id = me AND other_user_id = p_other_user_id
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (school_id, participant_id, other_user_id, role)
    VALUES (my_school, me, p_other_user_id, other_role)
    ON CONFLICT (participant_id, other_user_id) DO NOTHING;
    INSERT INTO conversations (school_id, participant_id, other_user_id, role)
    VALUES (my_school, p_other_user_id, me, my_role)
    ON CONFLICT (participant_id, other_user_id) DO NOTHING;

    SELECT id INTO conv_id FROM conversations
    WHERE participant_id = me AND other_user_id = p_other_user_id
    LIMIT 1;
  END IF;

  RETURN conv_id;
END;
$$;

-- 5) Rewritten send_chat_message: block-aware, resurrects hidden rows ---------
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
  other_participant UUID;
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

  RETURN new_id;
END;
$$;

-- 6) Unread counts from the database ------------------------------------------
-- Returns unread counts (messages from the other participant newer than my
-- last_read_at) for every conversation I participate in.
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE(conversation_id UUID, unread BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, COUNT(m.id)::bigint
  FROM conversations c
  LEFT JOIN chat_messages m
    ON m.conversation_id = c.id
   AND m.created_at > COALESCE(c.last_read_at, 'epoch'::timestamptz)
   AND m.from_id <> (SELECT id FROM profiles WHERE user_id = auth.uid())
  WHERE c.participant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND c.deleted_at IS NULL
  GROUP BY c.id;
$$;

-- 7) Batch grade approval + teacher notification ------------------------------
-- Atomically approve/reject a submission batch and send exactly ONE
-- notification per submitting teacher.
CREATE OR REPLACE FUNCTION public.approve_grade_submission(p_entry_ids UUID[], p_approved BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
  caller_school UUID;
  new_status TEXT;
  teacher_row RECORD;
BEGIN
  SELECT id, school_id INTO caller_profile_id, caller_school
  FROM profiles WHERE user_id = auth.uid();
  IF caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = caller_profile_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve grade submissions';
  END IF;

  new_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;

  UPDATE grade_entries
  SET approval_status = new_status
  WHERE id = ANY(p_entry_ids)
    AND school_id = caller_school;

  FOR teacher_row IN
    SELECT DISTINCT ge.submitted_by AS teacher_id, c.name AS course_name,
           t.full_name AS teacher_name
    FROM grade_entries ge
    JOIN courses c ON c.id = ge.course_id
    JOIN profiles t ON t.id = ge.submitted_by
    WHERE ge.id = ANY(p_entry_ids) AND ge.school_id = caller_school
  LOOP
    INSERT INTO notifications (school_id, recipient_id, actor_id, type, title, body, link)
    VALUES (
      caller_school,
      teacher_row.teacher_id,
      caller_profile_id,
      'grade',
      CASE WHEN p_approved THEN 'Grade submission approved' ELSE 'Grade submission rejected' END,
      format(
        '%s %s your submission for %s (%s grade%s).',
        (SELECT full_name FROM profiles WHERE id = caller_profile_id),
        CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
        teacher_row.course_name,
        (SELECT COUNT(*)::text FROM grade_entries g
          WHERE g.id = ANY(p_entry_ids) AND g.submitted_by = teacher_row.teacher_id
            AND g.approval_status = new_status),
        CASE WHEN (SELECT COUNT(*) FROM grade_entries g
          WHERE g.id = ANY(p_entry_ids) AND g.submitted_by = teacher_row.teacher_id
            AND g.approval_status = new_status) = 1 THEN '' ELSE 's' END
      ),
      '/teacher/classroom'
    );
  END LOOP;
END;
$$;

-- 8) Admins may update profiles in their school (level_label, section, ...).
--    The protect_profile_columns trigger still blocks non-admin field changes.
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
      AND p.school_id = profiles.school_id
  )
);

-- 9) Text-first school posts: title is optional --------------------------------
ALTER TABLE school_feed_posts ALTER COLUMN title DROP NOT NULL;
