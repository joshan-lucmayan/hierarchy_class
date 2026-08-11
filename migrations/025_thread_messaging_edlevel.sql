-- 025 — Messaging thread rewrite, leaderboard fix, notification clearing, and
--       the educational-level identity field.
--
-- A) MESSAGING
--    The old model stored TWO conversation rows per participant pair (one per
--    user, each with its own id). Messages were written under the sender's row
--    id, so the receiving participant's history query (their own row id)
--    returned nothing, and "delete then message again" resurrected the whole
--    old history. This migration collapses each pair into ONE shared
--    conversation row with per-side state columns:
--
--      user_a_id / user_b_id  (canonical LEAST/GREATEST ordering)
--      read_at_a / read_at_b
--      archived_a / archived_b
--      deleted_a / deleted_b  (deleted_at is a HISTORY CUTOFF for that side:
--                              old messages stay hidden even after the thread
--                              revives with new activity)
--
--    Messages now live under the single shared thread id, so both participants
--    see the same history. All state mutations move into SECURITY DEFINER
--    RPCs; the client has no direct UPDATE on conversations.
--
-- B) LEADERBOARD
--    get_school_leaderboard is rewritten with explicit output aliases (the
--    previous version sorted by the stale profiles.academic_excellence column
--    instead of the computed average) and now also returns educational level
--    and program name.
--
-- C) NOTIFICATIONS: cleared_at for per-user "clear my list" (soft hide).
--
-- D) PROFILES: educational_level (Elementary / High School / College) for the
--    student identity hierarchy (level -> grade -> program). Section stays in
--    the database for administration but is no longer the primary identity.

-- ---------------------------------------------------------------------------
-- 1) PROFILES: educational_level
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS educational_level TEXT;

-- Backfill from the existing level_label so existing rows get a sensible
-- default (admins can override in the student-management UI).
UPDATE profiles
SET educational_level = CASE
  WHEN level_label ~* '^(k|kinder|kindergarten|grade[[:space:]]*[1-6]($|[^0-9]))' THEN 'Elementary'
  WHEN level_label ~* '^grade[[:space:]]*([7-9]|1[0-2])($|[^0-9])' THEN 'High School'
  WHEN level_label ~* 'year|freshman|sophomore|junior|senior|^bs[[:space:]]|^ba[[:space:]]|college|university|associate' THEN 'College'
  ELSE NULL
END
WHERE educational_level IS NULL;

-- ---------------------------------------------------------------------------
-- 2) NOTIFICATIONS: per-user clear (soft hide)
-- ---------------------------------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notifications_cleared ON notifications(recipient_id, cleared_at);

-- ---------------------------------------------------------------------------
-- 3) CONVERSATIONS: shared-thread model
-- ---------------------------------------------------------------------------
-- Idempotency: if a previous run of this migration failed partway, any
-- leftover staging table is removed before starting over.
DROP TABLE IF EXISTS conversations_new;

CREATE TABLE conversations_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  user_a_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_a TEXT NOT NULL,
  role_b TEXT NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at_a TIMESTAMPTZ,
  read_at_b TIMESTAMPTZ,
  archived_a TIMESTAMPTZ,
  archived_b TIMESTAMPTZ,
  deleted_a TIMESTAMPTZ,
  deleted_b TIMESTAMPTZ,
  CONSTRAINT conversations_new_no_self CHECK (user_a_id <> user_b_id),
  CONSTRAINT conversations_new_pair_unique UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX idx_conversations_new_a ON conversations_new(user_a_id);
CREATE INDEX idx_conversations_new_b ON conversations_new(user_b_id);
CREATE INDEX idx_conversations_new_school ON conversations_new(school_id);

-- Defensive: the old code always created both directions of a pair, but if
-- only one direction exists for some pair, materialize the missing row first
-- so the collapse below never drops data.
INSERT INTO conversations (school_id, participant_id, other_user_id, role, last_message, last_message_at, created_at)
SELECT c.school_id, c.other_user_id, c.participant_id,
       COALESCE((SELECT role FROM profiles WHERE id = c.other_user_id), 'student'),
       c.last_message, c.last_message_at, c.created_at
FROM conversations c
WHERE NOT EXISTS (
  SELECT 1 FROM conversations c2
  WHERE c2.participant_id = c.other_user_id AND c2.other_user_id = c.participant_id
);

-- Collapse every participant pair into one row. user_a = the canonically
-- smaller profile id, so (user_a_id, user_b_id) is unique per pair no matter
-- which direction created it.
INSERT INTO conversations_new (
  id, school_id, user_a_id, user_b_id, role_a, role_b,
  last_message, last_message_at, created_at,
  read_at_a, read_at_b, archived_a, archived_b, deleted_a, deleted_b
)
SELECT
  gen_random_uuid(),
  ca.school_id,
  LEAST(ca.participant_id, ca.other_user_id),
  GREATEST(ca.participant_id, ca.other_user_id),
  COALESCE((SELECT role FROM profiles WHERE id = LEAST(ca.participant_id, ca.other_user_id)), 'student'),
  COALESCE((SELECT role FROM profiles WHERE id = GREATEST(ca.participant_id, ca.other_user_id)), 'student'),
  COALESCE(ca.last_message, cb.last_message),
  COALESCE(ca.last_message_at, cb.last_message_at, ca.created_at, cb.created_at),
  LEAST(ca.created_at, COALESCE(cb.created_at, ca.created_at)),
  CASE WHEN ca.participant_id = LEAST(ca.participant_id, ca.other_user_id) THEN ca.last_read_at ELSE cb.last_read_at END,
  CASE WHEN ca.participant_id = GREATEST(ca.participant_id, ca.other_user_id) THEN ca.last_read_at ELSE cb.last_read_at END,
  CASE WHEN ca.participant_id = LEAST(ca.participant_id, ca.other_user_id) THEN ca.archived_at ELSE cb.archived_at END,
  CASE WHEN ca.participant_id = GREATEST(ca.participant_id, ca.other_user_id) THEN ca.archived_at ELSE cb.archived_at END,
  CASE WHEN ca.participant_id = LEAST(ca.participant_id, ca.other_user_id) THEN ca.deleted_at ELSE cb.deleted_at END,
  CASE WHEN ca.participant_id = GREATEST(ca.participant_id, ca.other_user_id) THEN ca.deleted_at ELSE cb.deleted_at END
FROM conversations ca
LEFT JOIN conversations cb
  ON cb.participant_id = ca.other_user_id AND cb.other_user_id = ca.participant_id
WHERE ca.participant_id < ca.other_user_id;

-- Re-point every message to its new shared thread id.
CREATE TEMP TABLE conv_pair_map ON COMMIT DROP AS
SELECT c.id AS old_id, n.id AS new_id
FROM conversations c
JOIN conversations_new n
  ON (c.participant_id = n.user_a_id AND c.other_user_id = n.user_b_id)
  OR (c.participant_id = n.user_b_id AND c.other_user_id = n.user_a_id);

UPDATE chat_messages m
SET conversation_id = m2.new_id
FROM conv_pair_map m2
WHERE m.conversation_id = m2.old_id;

-- Safety net #1: any message still sitting on a legacy row (e.g. its pair
-- only existed in one direction) is re-pointed through the old table to the
-- shared thread for its participant pair.
UPDATE chat_messages m
SET conversation_id = n.id
FROM conversations c
JOIN conversations_new n
  ON (c.participant_id = n.user_a_id AND c.other_user_id = n.user_b_id)
  OR (c.participant_id = n.user_b_id AND c.other_user_id = n.user_a_id)
WHERE m.conversation_id = c.id
  AND NOT EXISTS (SELECT 1 FROM conversations_new x WHERE x.id = m.conversation_id);

-- Safety net #2: any message that does NOT end up under a shared thread
-- cannot exist in the new model and must go before the FK is re-added. That
-- includes true orphans (conversation row gone) and legacy self-conversations
-- (participant_id = other_user_id) - the pre-023 ensure_conversation had no
-- self-message check, so test data can contain them, and the new model
-- forbids them (CHECK user_a_id <> user_b_id). The count is reported so you
-- know exactly what was removed.
DO $$
DECLARE
  orphan_count INT;
BEGIN
  DELETE FROM chat_messages m
  WHERE NOT EXISTS (SELECT 1 FROM conversations_new n WHERE n.id = m.conversation_id);
  GET DIAGNOSTICS orphan_count = ROW_COUNT;
  IF orphan_count > 0 THEN
    RAISE NOTICE '025: removed % chat_messages row(s) that could not be mapped to a shared thread (orphaned or self-conversation data).', orphan_count;
  END IF;
END $$;

-- Drop the FK early so nothing blocks re-pointing/renaming; re-added below
-- after the swap (validates that every remaining message maps to a thread).
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_conversation_id_fkey;

-- Swap the tables. Policies on the old table die with it.
ALTER TABLE conversations RENAME TO conversations_legacy;
ALTER TABLE conversations_new RENAME TO conversations;

ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- Drop the stale chat_messages policies FIRST: they reference the old table
-- by OID, and PostgreSQL would otherwise refuse to drop it (policy
-- dependencies). They are recreated below for the new schema.
DROP POLICY IF EXISTS "chat_messages_participant_read" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_participant_create" ON chat_messages;

DROP TABLE conversations_legacy;

-- RLS: participants may read their shared threads. No INSERT/UPDATE/DELETE
-- policies - every state change goes through the SECURITY DEFINER RPCs below.
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_thread_read" ON conversations FOR SELECT USING (
  user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR user_b_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- chat_messages policies referenced the old participant_id column; rebuild
-- them for the shared-thread model. Direct writes are still only allowed for
-- your own messages inside a thread you participate in (the sanctioned path
-- is send_chat_message).
CREATE POLICY "chat_messages_participant_read" ON chat_messages FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
       OR user_b_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);
CREATE POLICY "chat_messages_participant_create" ON chat_messages FOR INSERT WITH CHECK (
  from_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND conversation_id IN (
    SELECT id FROM conversations
    WHERE user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
       OR user_b_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- 4) REWRITTEN MESSAGING FUNCTIONS
-- ---------------------------------------------------------------------------
-- Find or create the shared thread for a pair. A thread is permanent; per-side
-- deletes are history cutoffs, so re-messaging someone reuses the same thread
-- (which simply stops showing pre-delete history to the deleter).
CREATE OR REPLACE FUNCTION public.ensure_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
  my_school UUID;
  my_role TEXT;
  other_school UUID;
  other_role TEXT;
  a UUID;
  b UUID;
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

  IF EXISTS (
    SELECT 1 FROM chat_blocks
    WHERE (blocker_id = me AND blocked_id = p_other_user_id)
       OR (blocker_id = p_other_user_id AND blocked_id = me)
  ) THEN
    RAISE EXCEPTION 'Messaging is blocked with this user';
  END IF;

  a := LEAST(me, p_other_user_id);
  b := GREATEST(me, p_other_user_id);

  SELECT id INTO conv_id
  FROM conversations WHERE user_a_id = a AND user_b_id = b
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (school_id, user_a_id, user_b_id, role_a, role_b)
    VALUES (
      my_school, a, b,
      CASE WHEN a = me THEN my_role ELSE other_role END,
      CASE WHEN b = me THEN my_role ELSE other_role END
    )
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$;

-- Send a message into a shared thread. Block-aware. Bumps last_message and
-- revives the OTHER side from archive (a fresh message means the thread is
-- active again), but never touches their deleted_at - that is their history
-- cutoff, and clearing it would restore old history they chose to remove.
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

  IF conv.user_a_id = me THEN
    UPDATE conversations
    SET last_message = trim(p_text), last_message_at = now(), archived_b = NULL
    WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations
    SET last_message = trim(p_text), last_message_at = now(), archived_a = NULL
    WHERE id = p_conversation_id;
  END IF;

  RETURN new_id;
END;
$$;

-- Per-side state helpers. Each validates that the caller is a participant and
-- only ever touches the caller's own columns.
CREATE OR REPLACE FUNCTION public.set_conversation_read(p_conversation_id UUID, p_read BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
BEGIN
  SELECT id INTO me FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id AND (user_a_id = me OR user_b_id = me)
  ) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  IF EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id AND user_a_id = me) THEN
    UPDATE conversations SET read_at_a = CASE WHEN p_read THEN now() ELSE NULL END
    WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations SET read_at_b = CASE WHEN p_read THEN now() ELSE NULL END
    WHERE id = p_conversation_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_conversation_archived(p_conversation_id UUID, p_archived BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
BEGIN
  SELECT id INTO me FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id AND (user_a_id = me OR user_b_id = me)
  ) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  IF EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id AND user_a_id = me) THEN
    UPDATE conversations SET archived_a = CASE WHEN p_archived THEN now() ELSE NULL END
    WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations SET archived_b = CASE WHEN p_archived THEN now() ELSE NULL END
    WHERE id = p_conversation_id;
  END IF;
END;
$$;

-- Delete MY side of a conversation: hides it from my inbox and sets my history
-- cutoff so old messages never come back even if the thread revives. The other
-- participant's side and the messages themselves are untouched.
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID;
BEGIN
  SELECT id INTO me FROM profiles WHERE user_id = auth.uid();
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id AND (user_a_id = me OR user_b_id = me)
  ) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;

  IF EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id AND user_a_id = me) THEN
    UPDATE conversations SET deleted_a = now() WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations SET deleted_b = now() WHERE id = p_conversation_id;
  END IF;
END;
$$;

-- Unread counts for my inbox. Only threads currently visible to me count
-- (not archived; deleted threads only when they have revived with new
-- activity), and only messages newer than both my read time and my history
-- cutoff from the other participant.
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE(conversation_id UUID, unread BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS conversation_id,
         COUNT(m.id)::bigint AS unread
  FROM conversations c
  LEFT JOIN chat_messages m
    ON m.conversation_id = c.id
   AND m.from_id <> (SELECT id FROM profiles WHERE user_id = auth.uid())
   AND m.created_at > COALESCE(
         CASE WHEN c.user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
              THEN c.read_at_a ELSE c.read_at_b END,
         'epoch'::timestamptz)
   AND m.created_at > COALESCE(
         CASE WHEN c.user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
              THEN c.deleted_a ELSE c.deleted_b END,
         'epoch'::timestamptz)
  WHERE (c.user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR c.user_b_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    AND CASE WHEN c.user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
             THEN c.archived_a ELSE c.archived_b END IS NULL
  GROUP BY c.id;
$$;

-- ---------------------------------------------------------------------------
-- 5) LEADERBOARD: correct ordering + educational level + program
-- ---------------------------------------------------------------------------
-- The previous version ordered by profiles.academic_excellence (the stored,
-- stale column) because the computed average had no output alias; it also
-- lacked program/educational-level context. Rewritten with explicit aliases so
-- ranking uses the LIVE approved-only average, and the row carries the student
-- identity fields the UI needs. Only aggregates are returned - individual
-- grade rows stay private.
-- PostgreSQL cannot change a function's return type via CREATE OR REPLACE
-- (42P13), so the old 022 version must be dropped before the new one.
DROP FUNCTION IF EXISTS public.get_school_leaderboard();

CREATE FUNCTION public.get_school_leaderboard()
RETURNS TABLE(
  student_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  level_label TEXT,
  section TEXT,
  educational_level TEXT,
  program_name TEXT,
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
  SELECT p.id AS student_id,
         p.full_name,
         p.avatar_url,
         p.level_label,
         p.section,
         p.educational_level,
         (
           SELECT pr.name
           FROM course_enrollments ce
           JOIN courses c ON c.id = ce.course_id
           JOIN sections s ON s.id = c.section_id
           JOIN programs pr ON pr.id = s.program_id
           WHERE ce.student_id = p.id
           ORDER BY ce.created_at ASC
           LIMIT 1
         ) AS program_name,
         CASE WHEN COUNT(ge.id) = 0 THEN NULL::numeric
              ELSE ROUND(AVG(ge.score)::numeric, 1)
         END AS academic_excellence
  FROM profiles p
  LEFT JOIN grade_entries ge
    ON ge.student_id = p.id AND ge.approval_status = 'approved'
  WHERE p.school_id = my_school AND p.role = 'student'
  GROUP BY p.id, p.full_name, p.avatar_url, p.level_label, p.section, p.educational_level
  ORDER BY academic_excellence DESC NULLS LAST;
END;
$$;
