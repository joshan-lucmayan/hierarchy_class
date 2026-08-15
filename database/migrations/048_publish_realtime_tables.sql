-- ===========================================================================
-- 048_publish_realtime_tables.sql
-- The app's stores subscribe to postgres_changes on these tables (rankStore,
-- classroomHierarchyStore, habitStore, chatStore, notificationsStore,
-- useMyProfile, useSchoolProfiles, the profile viewer) - but none of them were
-- in the supabase_realtime publication, so NO realtime event ever reached the
-- browser. Every live-update (rank bar after a grade is fed, habits, messages,
-- notifications, profiles) silently required a full page reload. This makes
-- the live layer actually live.
--
-- Idempotent: adds each table only if it is not already published.
-- ===========================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'grade_entries',
    'student_rank_state',
    'rank_period_entries',
    'rank_history_log',
    'habit_entries',
    'chat_blocks',
    'chat_messages',
    'notifications'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'published %', t;
    END IF;
  END LOOP;
END $$;
