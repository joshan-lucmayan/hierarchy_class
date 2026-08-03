-- Phase 1: Core auth + schools + profiles tables
-- This migration sets up the foundational tables and RLS policies for authentication

-- 1. SCHOOLS TABLE
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_schools_active ON schools(active);

-- 2. PROFILES TABLE (extends auth.users)
-- user_id is the auth.users.id, linked via triggers
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id),
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  full_name TEXT NOT NULL,
  level_label TEXT, -- "Grade 10", "2nd Year", "Freshman", etc.
  section TEXT, -- e.g. "Zeus", "Section A"
  initials TEXT,
  bio TEXT,
  overall_rank TEXT DEFAULT 'B',
  academic_excellence INT DEFAULT 50,
  favorite_subject TEXT,
  tags JSONB DEFAULT '[]',
  hobbies JSONB DEFAULT '[]',
  interests JSONB DEFAULT '[]',
  is_librarian BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_school_id ON profiles(school_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- 3. LEARNING_MATERIALS TABLE
CREATE TABLE IF NOT EXISTS learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  level_label TEXT, -- e.g. "Grade 10", "All Levels"
  type TEXT NOT NULL, -- "Worksheet", "Article", "Video", "Guide"
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  upload_date TIMESTAMPTZ DEFAULT now(),
  description TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_learning_materials_school ON learning_materials(school_id);
CREATE INDEX idx_learning_materials_subject ON learning_materials(subject);

-- 4. LIBRARY_BOOKS TABLE
CREATE TABLE IF NOT EXISTS library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT NOT NULL,
  status TEXT DEFAULT 'available', -- "available", "requested", "borrowed"
  borrowed_by UUID REFERENCES profiles(id),
  borrowed_by_name TEXT,
  borrowed_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_library_books_school ON library_books(school_id);
CREATE INDEX idx_library_books_status ON library_books(status);
CREATE INDEX idx_library_books_borrowed_by ON library_books(borrowed_by);

-- 5. LIBRARY_BORROW_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS library_borrow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- "pending", "approved", "declined"
  pickup_window TEXT,
  requested_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_borrow_requests_school ON library_borrow_requests(school_id);
CREATE INDEX idx_borrow_requests_status ON library_borrow_requests(status);
CREATE INDEX idx_borrow_requests_student ON library_borrow_requests(student_id);

-- 6. LIBRARY_BORROW_LOG TABLE
CREATE TABLE IF NOT EXISTS library_borrow_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  book_id UUID NOT NULL REFERENCES library_books(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL, -- "borrowed", "returned"
  date TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_borrow_log_school ON library_borrow_log(school_id);
CREATE INDEX idx_borrow_log_book ON library_borrow_log(book_id);
CREATE INDEX idx_borrow_log_student ON library_borrow_log(student_id);

-- 7. QUIZZES TABLE
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  level_label TEXT, -- e.g. "Grade 10", "All Levels"
  time_limit_seconds INT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_quizzes_school ON quizzes(school_id);
CREATE INDEX idx_quizzes_subject ON quizzes(subject);

-- 8. QUIZ_QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- ["option1", "option2", ...]
  correct_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- 9. QUIZ_ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  quiz_id UUID NOT NULL REFERENCES quizzes(id),
  score INT NOT NULL,
  total INT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_quiz_attempts_school ON quiz_attempts(school_id);
CREATE INDEX idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- 10. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  participant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- "student", "teacher", "admin" - role context for the conversation
  last_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_conversations_school ON conversations(school_id);
CREATE INDEX idx_conversations_participant ON conversations(participant_id);
CREATE INDEX idx_conversations_other_user ON conversations(other_user_id);

-- 11. CHAT_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_id UUID REFERENCES profiles(id), -- NULL for system messages
  from_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_from ON chat_messages(from_id);

-- 12. FRIENDS TABLE
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  user_a_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a_id, user_b_id)
);
CREATE INDEX idx_friends_school ON friends(school_id);
CREATE INDEX idx_friends_user_a ON friends(user_a_id);
CREATE INDEX idx_friends_user_b ON friends(user_b_id);

-- 13. SCHOOL_FEED_POSTS TABLE
CREATE TABLE IF NOT EXISTS school_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  tag TEXT NOT NULL, -- "Campaign", "Enrollment", "Advisory", etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_school_feed_school ON school_feed_posts(school_id);

-- 14. BANNER_CONFIG TABLE
CREATE TABLE IF NOT EXISTS banner_config (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  image_url TEXT,
  focal_y INT DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. FLORIN_BALANCES TABLE
CREATE TABLE IF NOT EXISTS florin_balances (
  student_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 16. FLORIN_TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS florin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_florin_transactions_school ON florin_transactions(school_id);
CREATE INDEX idx_florin_transactions_student ON florin_transactions(student_id);

-- ============================================================================
-- RLS POLICIES - Phase 1 (Auth & Core)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_borrow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_borrow_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE florin_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE florin_transactions ENABLE ROW LEVEL SECURITY;

-- SCHOOLS: Public read (to populate school selectors), admins can manage
CREATE POLICY "schools_public_read" ON schools FOR SELECT USING (true);
CREATE POLICY "schools_admin_write" ON schools FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "profiles_user_reads_own" ON profiles;
DROP POLICY IF EXISTS "profiles_school_sees_all" ON profiles;
DROP POLICY IF EXISTS "profiles_user_updates_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_writes" ON profiles;
DROP POLICY IF EXISTS "profiles_user_inserts_own" ON profiles;

-- PROFILES: Users see their own profile only (avoid recursive SELECT)
-- Note: School-level visibility is handled via auth.user_metadata.school_id (set at signup)
CREATE POLICY "profiles_user_reads_own" ON profiles FOR SELECT USING (
  auth.uid() = user_id
);

CREATE POLICY "profiles_user_updates_own" ON profiles FOR UPDATE USING (
  auth.uid() = user_id
);

CREATE POLICY "profiles_user_inserts_own" ON profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);


-- LEARNING_MATERIALS: School users can read, teachers can write
CREATE POLICY "materials_school_read" ON learning_materials FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);
CREATE POLICY "materials_teacher_write" ON learning_materials FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'teacher'
    AND school_id = learning_materials.school_id)
);

-- LIBRARY_BOOKS: School users can read, teachers/librarians can update status
CREATE POLICY "books_school_read" ON library_books FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);
CREATE POLICY "books_teacher_update" ON library_books FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() 
    AND (role = 'teacher' OR is_librarian = true)
    AND school_id = library_books.school_id)
);

-- LIBRARY_BORROW_REQUESTS: Students see their own, teachers/librarians see all in school
CREATE POLICY "borrow_requests_student_read" ON library_borrow_requests FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "borrow_requests_teacher_read" ON library_borrow_requests FOR SELECT USING (
  school_id IN (SELECT school_id FROM profiles WHERE user_id = auth.uid() 
    AND (role = 'teacher' OR role = 'admin'))
);
CREATE POLICY "borrow_requests_student_create" ON library_borrow_requests FOR INSERT WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "borrow_requests_teacher_update" ON library_borrow_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() 
    AND (role = 'teacher' OR is_librarian = true OR role = 'admin')
    AND school_id = library_borrow_requests.school_id)
);

-- QUIZZES: School users can read, teachers can create
CREATE POLICY "quizzes_school_read" ON quizzes FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);
CREATE POLICY "quizzes_teacher_create" ON quizzes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND (role = 'teacher' OR role = 'admin'))
);

-- QUIZ_QUESTIONS: Same visibility as parent quiz
CREATE POLICY "quiz_questions_school_read" ON quiz_questions FOR SELECT USING (
  quiz_id IN (SELECT id FROM quizzes WHERE school_id IN 
    (SELECT school_id FROM profiles WHERE user_id = auth.uid()))
);

-- QUIZ_ATTEMPTS: Students see their own, teachers see all in school
CREATE POLICY "quiz_attempts_student_read" ON quiz_attempts FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "quiz_attempts_teacher_read" ON quiz_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() 
    AND (role = 'teacher' OR role = 'admin')
    AND school_id = quiz_attempts.school_id)
);
CREATE POLICY "quiz_attempts_student_create" ON quiz_attempts FOR INSERT WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- CONVERSATIONS: Only participants can see
CREATE POLICY "conversations_participant_read" ON conversations FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM profiles WHERE id IN (participant_id, other_user_id)
  )
);
CREATE POLICY "conversations_participant_create" ON conversations FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = participant_id
  )
);

-- CHAT_MESSAGES: Only conversation participants can read and write
CREATE POLICY "chat_messages_participant_read" ON chat_messages FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE auth.uid() IN (
      SELECT user_id FROM profiles WHERE id IN (participant_id, other_user_id)
    )
  )
);
CREATE POLICY "chat_messages_participant_create" ON chat_messages FOR INSERT WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations WHERE auth.uid() IN (
      SELECT user_id FROM profiles WHERE id = participant_id
    )
  )
);

-- SCHOOL_FEED_POSTS: School users can read
CREATE POLICY "feed_posts_school_read" ON school_feed_posts FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);
CREATE POLICY "feed_posts_admin_write" ON school_feed_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = school_feed_posts.school_id)
);

-- BANNER_CONFIG: School users can read, admins can update
CREATE POLICY "banner_school_read" ON banner_config FOR SELECT USING (
  school_id = (auth.user_metadata->>'school_id')::uuid
);
CREATE POLICY "banner_admin_update" ON banner_config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = banner_config.school_id)
);
CREATE POLICY "banner_admin_insert" ON banner_config FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- FLORIN_BALANCES: Students see own, teachers/admins see school's
CREATE POLICY "florin_student_read_own" ON florin_balances FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "florin_teacher_read_school" ON florin_balances FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p1 WHERE user_id = auth.uid() AND (role = 'teacher' OR role = 'admin')
    AND school_id IN (SELECT school_id FROM profiles p2 WHERE p2.id = florin_balances.student_id))
);
CREATE POLICY "florin_student_update_own" ON florin_balances FOR UPDATE USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- FLORIN_TRANSACTIONS: Students see own, teachers/admins see school's
CREATE POLICY "florin_trans_student_read" ON florin_transactions FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "florin_trans_teacher_read" ON florin_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p1 WHERE user_id = auth.uid() AND (role = 'teacher' OR role = 'admin')
    AND school_id = florin_transactions.school_id)
);
CREATE POLICY "florin_trans_student_create" ON florin_transactions FOR INSERT WITH CHECK (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
