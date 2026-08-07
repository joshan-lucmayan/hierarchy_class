-- Phase 2: Classroom hierarchy - programs, sections, courses, enrollment,
-- grade entries, and admin-to-teacher task assignments.
-- Mirrors the pattern from 001/005: school-scoped RLS via
-- auth.jwt() -> 'user_metadata' ->> 'school_id'.

-- 1. PROGRAMS TABLE
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_programs_school ON programs(school_id);

-- 2. SECTIONS TABLE (a "year" or "grade level" within a program)
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sections_school ON sections(school_id);
CREATE INDEX idx_sections_program ON sections(program_id);

-- 3. COURSES TABLE (a subject/course within a section, assigned to one teacher)
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_courses_school ON courses(school_id);
CREATE INDEX idx_courses_section ON courses(section_id);
CREATE INDEX idx_courses_teacher ON courses(teacher_id);

-- 4. COURSE_ENROLLMENTS TABLE (a student enrolled in a course)
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, student_id)
);
CREATE INDEX idx_enrollments_school ON course_enrollments(school_id);
CREATE INDEX idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX idx_enrollments_student ON course_enrollments(student_id);

-- 5. GRADE_ENTRIES TABLE (a single exam/quiz/activity score for one student)
CREATE TABLE IF NOT EXISTS grade_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('Exam', 'Quiz', 'Activity', 'Assignment')),
  label TEXT,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_grade_entries_school ON grade_entries(school_id);
CREATE INDEX idx_grade_entries_course ON grade_entries(course_id);
CREATE INDEX idx_grade_entries_student ON grade_entries(student_id);

-- 6. TEACHER_TASKS TABLE (admin assigns a task to a teacher; accept/decline flow)
CREATE TABLE IF NOT EXISTS teacher_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'done')),
  decline_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_teacher_tasks_school ON teacher_tasks(school_id);
CREATE INDEX idx_teacher_tasks_teacher ON teacher_tasks(teacher_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_tasks ENABLE ROW LEVEL SECURITY;

-- PROGRAMS: school-wide read, admin write
CREATE POLICY "programs_school_read" ON programs FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);
CREATE POLICY "programs_admin_write" ON programs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = programs.school_id)
);

-- SECTIONS: school-wide read, admin write
CREATE POLICY "sections_school_read" ON sections FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);
CREATE POLICY "sections_admin_write" ON sections FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = sections.school_id)
);

-- COURSES: school-wide read, admin write
CREATE POLICY "courses_school_read" ON courses FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);
CREATE POLICY "courses_admin_write" ON courses FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = courses.school_id)
);

-- COURSE_ENROLLMENTS: school-wide read (so teachers/students see rosters), admin write
CREATE POLICY "enrollments_school_read" ON course_enrollments FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);
CREATE POLICY "enrollments_admin_write" ON course_enrollments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = course_enrollments.school_id)
);

-- GRADE_ENTRIES: school-wide read (students see their own via app-level filter,
-- teachers/admin see all - fine-grained student-only visibility is enforced by
-- the app querying by student_id, matching the pattern used elsewhere for reads).
CREATE POLICY "grade_entries_school_read" ON grade_entries FOR SELECT USING (
  school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
);
-- Only the assigned teacher for that course (or an admin) can submit grades
CREATE POLICY "grade_entries_teacher_write" ON grade_entries FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.id = grade_entries.submitted_by
    AND (
      p.role = 'admin'
      OR EXISTS (SELECT 1 FROM courses c WHERE c.id = grade_entries.course_id AND c.teacher_id = p.id)
    )
  )
);
CREATE POLICY "grade_entries_teacher_delete" ON grade_entries FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND (
      p.role = 'admin'
      OR EXISTS (SELECT 1 FROM courses c WHERE c.id = grade_entries.course_id AND c.teacher_id = p.id)
    )
  )
);

-- TEACHER_TASKS: teacher sees/updates their own, admin sees/writes all in school
CREATE POLICY "teacher_tasks_own_read" ON teacher_tasks FOR SELECT USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "teacher_tasks_admin_read" ON teacher_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = teacher_tasks.school_id)
);
CREATE POLICY "teacher_tasks_admin_create" ON teacher_tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = teacher_tasks.school_id)
);
CREATE POLICY "teacher_tasks_own_update" ON teacher_tasks FOR UPDATE USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = teacher_tasks.school_id)
);
