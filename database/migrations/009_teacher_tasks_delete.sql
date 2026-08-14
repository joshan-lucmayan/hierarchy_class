-- teacher_tasks previously had no DELETE policy at all, so neither the
-- assigned teacher nor the admin who assigned it could ever remove a task.
CREATE POLICY "teacher_tasks_delete" ON teacher_tasks FOR DELETE USING (
  teacher_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    AND school_id = teacher_tasks.school_id)
);
