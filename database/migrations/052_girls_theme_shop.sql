-- ===========================================================================
-- 052_girls_theme_shop.sql
-- Two shop updates that go with the Rose (girls) theme:
--
--   1. Renames the "Golden Hour" background to "Samurai Sword" - the actual
--      subject of the image.
--   2. Adds the two pink backgrounds for the girls' theme: Pink Butterfly
--      and Pink Cat (assets in public/hc_bg/).
--
-- Idempotent: UPDATE guarded by name, INSERT guarded by image_url.
-- ===========================================================================

-- 1) Rename -------------------------------------------------------------------
UPDATE shop_items
SET name = 'Samurai Sword'
WHERE name = 'Golden Hour' AND type = 'background';

-- 2) Girls' backgrounds --------------------------------------------------------
INSERT INTO shop_items (type, name, description, price, image_url, accent, sort_order)
SELECT * FROM (VALUES
  ('background', 'Pink Butterfly', 'A soft flutter of pink across your pages.', 220, '/hc_bg/pink_butterfly.jpg', NULL, 25),
  ('background', 'Pink Cat', 'A cozy pink friend behind every card.', 240, '/hc_bg/pink_cat.jpg', NULL, 26)
) AS s(type, name, description, price, image_url, accent, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM shop_items WHERE image_url IN ('/hc_bg/pink_butterfly.jpg', '/hc_bg/pink_cat.jpg')
);
