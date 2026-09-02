-- ===========================================================================
-- 050_shop.sql
-- Florin shop: students spend their Florin balance on decorative page
-- backgrounds and avatar borders (Discord-style). Three tables:
--
--   shop_items            - catalog of what is for sale
--   shop_ownership        - who owns what (unique per student + item)
--   student_shop_loadout  - what each student currently has equipped
--
-- Security follows the migration 022 hardening: clients get SELECT-only
-- policies. All money movement (purchase = check balance, deduct, record a
-- florin_transaction, grant ownership) and equipping run through SECURITY
-- DEFINER RPCs, so a student can never mint Florin or equip an item they do
-- not own.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE FUNCTION, guarded seed inserts.
-- ===========================================================================

-- 1) Tables ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('background', 'avatar_border')),
  name TEXT NOT NULL,
  description TEXT,
  price INT NOT NULL CHECK (price >= 0),
  image_url TEXT,
  accent TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_ownership_student ON shop_ownership(student_id);

CREATE TABLE IF NOT EXISTS student_shop_loadout (
  student_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  background_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  avatar_border_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) RLS ---------------------------------------------------------------------
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_shop_loadout ENABLE ROW LEVEL SECURITY;

-- Catalog: any signed-in user can browse.
DROP POLICY IF EXISTS "shop_items_authenticated_read" ON shop_items;
CREATE POLICY "shop_items_authenticated_read" ON shop_items FOR SELECT USING (auth.role() = 'authenticated');

-- Ownership: the owner reads their own purchases. Writes happen in the RPCs.
DROP POLICY IF EXISTS "shop_ownership_owner_read" ON shop_ownership;
CREATE POLICY "shop_ownership_owner_read" ON shop_ownership FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Loadout: the owner reads their own; same-school users can read so each
-- user's avatar decoration shows up on other people's avatars (decoration
-- only, no money involved).
DROP POLICY IF EXISTS "loadout_owner_read" ON student_shop_loadout;
CREATE POLICY "loadout_owner_read" ON student_shop_loadout FOR SELECT USING (
  student_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "loadout_school_read" ON student_shop_loadout;
CREATE POLICY "loadout_school_read" ON student_shop_loadout FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM profiles me
    JOIN profiles target ON target.id = student_shop_loadout.student_id
    WHERE me.user_id = auth.uid() AND me.school_id = target.school_id
  )
);

-- 3) RPCs --------------------------------------------------------------------

-- Buy an item: validates the caller is a student, the item is available and
-- not already owned, and the balance covers the price. All three writes
-- (balance, transaction, ownership) happen inside one SECURITY DEFINER call.
CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID;
  v_school UUID;
  v_role TEXT;
  v_item shop_items%ROWTYPE;
  v_balance INT;
  v_owned BOOLEAN;
BEGIN
  SELECT id, school_id, role INTO v_me, v_school, v_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_me IS NULL OR v_role <> 'student' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_student');
  END IF;

  SELECT * INTO v_item FROM shop_items WHERE id = p_item_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_unavailable');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM shop_ownership WHERE student_id = v_me AND item_id = p_item_id
  ) INTO v_owned;
  IF v_owned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned');
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM florin_balances WHERE student_id = v_me;
  IF v_balance < v_item.price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'balance', v_balance);
  END IF;

  UPDATE florin_balances
  SET balance = balance - v_item.price, updated_at = now()
  WHERE student_id = v_me;

  INSERT INTO florin_transactions (school_id, student_id, amount, reason)
  VALUES (v_school, v_me, -v_item.price, 'Purchased: ' || v_item.name);

  INSERT INTO shop_ownership (student_id, item_id) VALUES (v_me, p_item_id);

  RETURN jsonb_build_object('ok', true, 'balance', v_balance - v_item.price, 'item_id', p_item_id);
END;
$$;

-- Equip an owned item into a slot ('background' | 'avatar_border'). Validates
-- ownership and that the item type matches the slot before upserting the
-- loadout row.
CREATE OR REPLACE FUNCTION public.equip_shop_item(p_item_id UUID, p_slot TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID;
  v_slot TEXT;
  v_type TEXT;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_slot := lower(p_slot);
  IF v_slot NOT IN ('background', 'avatar_border') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_slot');
  END IF;

  SELECT type INTO v_type FROM shop_items WHERE id = p_item_id AND active;
  IF v_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_unavailable');
  END IF;
  IF v_type <> v_slot THEN
    RETURN jsonb_build_object('ok', false, 'error', 'type_mismatch');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM shop_ownership WHERE student_id = v_me AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owned');
  END IF;

  INSERT INTO student_shop_loadout (student_id, background_item_id, avatar_border_item_id, updated_at)
  VALUES (
    v_me,
    CASE WHEN v_slot = 'background' THEN p_item_id END,
    CASE WHEN v_slot = 'avatar_border' THEN p_item_id END,
    now()
  )
  ON CONFLICT (student_id) DO UPDATE SET
    background_item_id = CASE WHEN v_slot = 'background' THEN p_item_id ELSE student_shop_loadout.background_item_id END,
    avatar_border_item_id = CASE WHEN v_slot = 'avatar_border' THEN p_item_id ELSE student_shop_loadout.avatar_border_item_id END,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Clear a slot ('background' | 'avatar_border') back to the default.
CREATE OR REPLACE FUNCTION public.unequip_shop_item(p_slot TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF lower(p_slot) = 'background' THEN
    UPDATE student_shop_loadout SET background_item_id = NULL, updated_at = now() WHERE student_id = v_me;
  ELSIF lower(p_slot) = 'avatar_border' THEN
    UPDATE student_shop_loadout SET avatar_border_item_id = NULL, updated_at = now() WHERE student_id = v_me;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'bad_slot');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4) Seed catalog (only on first run) ----------------------------------------
INSERT INTO shop_items (type, name, description, price, image_url, accent, sort_order)
SELECT * FROM (VALUES
  ('background', 'Chess Court', 'A quiet board of kings and queens behind every card.', 250, '/hc_bg/chess_bg.jpg', NULL, 10),
  ('background', 'Samurai Sword', 'A blade of light for the whole campus.', 300, '/hc_bg/sum_bg.jpg', NULL, 20),
  ('avatar_border', 'Slate Ring', 'A clean ring in the accent slate.', 80, NULL, '#9EA7B3', 30),
  ('avatar_border', 'Pearl Ring', 'A brighter halo for your avatar.', 120, NULL, '#C2C7CF', 40),
  ('avatar_border', 'Crimson Ring', 'A warm warning-tone ring.', 150, NULL, '#C98F8F', 50),
  ('avatar_border', 'Emerald Ring', 'A calm green ring.', 150, NULL, '#8FA88F', 60)
) AS s(type, name, description, price, image_url, accent, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM shop_items);

-- 5) Realtime ------------------------------------------------------------------
-- Keep loadouts and ownership live so equipping in one tab reflects on other
-- open tabs without a reload (same pattern as migration 048).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shop_ownership', 'student_shop_loadout']
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
