-- ===========================================================================
-- 062: FIX appeals_own_create - variable shadowing made appeals unsubmittable.
--
-- Migration 060 defined the policy as:
--
--   EXISTS (
--     SELECT 1 FROM profiles p
--     WHERE p.id = user_id AND p.restricted_at IS NOT NULL
--   )
--
-- Inside the subquery, the unqualified `user_id` resolved to the INNER
-- table's own column (profiles.user_id), so the check became
-- `p.id = p.user_id` - profile ids are UUIDs, user ids are auth UUIDs,
-- never equal. The restriction gate could never pass, so restricted users
-- could not submit an appeal at all (RLS 42501 on every insert).
--
-- Fix: qualify the outer reference as account_appeals.user_id so the
-- subquery correlates with the NEW row. Discovered + fixed during the
-- v1.7.66 production verification, not by the (syntax-only) dry-run.
--
-- Idempotent (DROP POLICY IF EXISTS + CREATE POLICY). Applied AFTER 060/061.
-- ===========================================================================

DROP POLICY IF EXISTS "appeals_own_create" ON account_appeals;

CREATE POLICY "appeals_own_create" ON account_appeals FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND school_id = (SELECT school_id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = account_appeals.user_id AND p.restricted_at IS NOT NULL
  )
);
