-- ===========================================================================
-- 051_profile_card_shop.sql
-- Third shop item type: PROFILE CARD backgrounds - the decorative image that
-- sits behind a student's profile card when other people view their profile.
-- (The other two types: 'background' = the viewer's own page backdrop, and
-- 'avatar_border' = the ring around the avatar.)
--
--   1. Extends shop_items.type CHECK to include 'profile_card'.
--   2. Adds student_shop_loadout.profile_card_item_id (equipped card).
--   3. Extends equip_shop_item / unequip_shop_item to handle the slot.
--   4. Seeds four profile card backgrounds (SVG assets in public/hc_bg/).
--
-- Idempotent: guarded ALTERs, DROP + CREATE OR REPLACE, guarded seeds.
-- ===========================================================================

-- 1) Extend the type constraint ----------------------------------------------
ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_type_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_type_check
  CHECK (type IN ('background', 'avatar_border', 'profile_card'));

-- 2) Loadout column -----------------------------------------------------------
ALTER TABLE student_shop_loadout
  ADD COLUMN IF NOT EXISTS profile_card_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;

-- 3) RPCs ---------------------------------------------------------------------

-- Equip an owned item into a slot ('background' | 'avatar_border' |
-- 'profile_card'). Validates ownership and that the item type matches the
-- slot before upserting the loadout row.
DROP FUNCTION IF EXISTS public.equip_shop_item(uuid, text);
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
  IF v_slot NOT IN ('background', 'avatar_border', 'profile_card') THEN
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

  INSERT INTO student_shop_loadout (
    student_id, background_item_id, avatar_border_item_id, profile_card_item_id, updated_at
  )
  VALUES (
    v_me,
    CASE WHEN v_slot = 'background' THEN p_item_id END,
    CASE WHEN v_slot = 'avatar_border' THEN p_item_id END,
    CASE WHEN v_slot = 'profile_card' THEN p_item_id END,
    now()
  )
  ON CONFLICT (student_id) DO UPDATE SET
    background_item_id = CASE WHEN v_slot = 'background' THEN p_item_id ELSE student_shop_loadout.background_item_id END,
    avatar_border_item_id = CASE WHEN v_slot = 'avatar_border' THEN p_item_id ELSE student_shop_loadout.avatar_border_item_id END,
    profile_card_item_id = CASE WHEN v_slot = 'profile_card' THEN p_item_id ELSE student_shop_loadout.profile_card_item_id END,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Clear a slot ('background' | 'avatar_border' | 'profile_card') back to the
-- default.
DROP FUNCTION IF EXISTS public.unequip_shop_item(text);
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
  ELSIF lower(p_slot) = 'profile_card' THEN
    UPDATE student_shop_loadout SET profile_card_item_id = NULL, updated_at = now() WHERE student_id = v_me;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'bad_slot');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4) Seed profile card backgrounds (only on first run) -------------------------
INSERT INTO shop_items (type, name, description, price, image_url, accent, sort_order)
SELECT * FROM (VALUES
  ('profile_card', 'Royal Slate', 'A quiet crown over deep slate. Your profile card, dressed.', 200, '/hc_bg/card_royal.svg', NULL, 70),
  ('profile_card', 'Midnight Board', 'A faint chessboard with a lone king. For the strategists.', 220, '/hc_bg/card_board.svg', NULL, 80),
  ('profile_card', 'Gold Ribbon', 'Flowing ribbons and sparkles across your card.', 260, '/hc_bg/card_ribbon.svg', NULL, 90),
  ('profile_card', 'Crown Court', 'The emblem glowing at the center of your card.', 300, '/hc_bg/card_crown.svg', NULL, 100)
) AS s(type, name, description, price, image_url, accent, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE type = 'profile_card');
