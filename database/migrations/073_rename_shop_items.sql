-- Rename shop items whose names include "gold" but whose actual appearance
-- does not match the description:
--   "Pale Gold Ring"  (#C2C7CF = light gray)  → "Pearl Ring"
--   "Gold Ribbon"     (no accent color)        → "Royal Ribbon"
--   "Golden Hour" was already renamed to "Samurai Sword" in migration 052.

UPDATE shop_items SET name = 'Pearl Ring' WHERE name = 'Pale Gold Ring' AND type = 'avatar_border';
UPDATE shop_items SET name = 'Royal Ribbon' WHERE name = 'Gold Ribbon' AND type = 'profile_card';