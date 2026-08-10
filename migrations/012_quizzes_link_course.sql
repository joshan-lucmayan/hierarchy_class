-- Quizzes previously used free-text subject/level_label with no real link
-- to the actual Program/Section/Course hierarchy, so a student's "grade
-- level" match was against mock data, not their real enrollment. Link
-- quizzes to a real course instead.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes(course_id);

-- Tighten quiz creation to only the teacher actually assigned to that
-- course (or an admin), instead of any teacher in the school.
DROP POLICY IF EXISTS "quizzes_teacher_create" ON quizzes;
CREATE POLICY "quizzes_teacher_create" ON quizzes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND (
      p.role = 'admin'
      OR EXISTS (SELECT 1 FROM courses c WHERE c.id = quizzes.course_id AND c.teacher_id = p.id)
    )
  )
);
