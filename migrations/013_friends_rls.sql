-- The friends table has existed since migration 001 but never had any RLS
-- policies, so no one could actually read or write to it.

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friends_read_own" ON friends FOR SELECT USING (
  user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR user_b_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "friends_create_own" ON friends FOR INSERT WITH CHECK (
  user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "friends_delete_own" ON friends FOR DELETE USING (
  user_a_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR user_b_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);
