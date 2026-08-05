-- Migration 010: Record a product's subcategory.
--
-- The catalog filters offer Sneakers / Sandals / Boots, but all three are
-- labels over the single category value 'footwear', so a product had no way to
-- say which one it is. The same holds for Jackets / Coats / Parkas / Vests /
-- Bomber Jackets / Raincoats under 'outerwear', T-Shirts / Hoodies &
-- Sweatshirts under 'tops', and Hats / Belts / Sunglasses / Watches under
-- 'accessories'.
--
-- The column is nullable on purpose: a row without one still matches its
-- category, so the catalog keeps working while the field is filled in.

alter table products
  add column if not exists subcategory text;

-- Filters query by category first and narrow by subcategory, so the pair is
-- what the index should cover.
create index if not exists products_subcategory_idx
  on products (category, subcategory);

-- Backfill the categories that only one label can mean. The ambiguous ones
-- (outerwear, tops, footwear, accessories) are left null for an editor to set
-- in the admin panel — guessing them from the name would be wrong more often
-- than it would be right.
update products set subcategory = 'Blazers'    where category = 'blazers'    and subcategory is null;
update products set subcategory = 'Shirts'     where category = 'shirts'     and subcategory is null;
update products set subcategory = 'Knitwear'   where category = 'knitwear'   and subcategory is null;
update products set subcategory = 'Pants'      where category = 'bottoms'    and subcategory is null;
update products set subcategory = 'Jeans'      where category = 'jeans'      and subcategory is null;
update products set subcategory = 'Shorts'     where category = 'shorts'     and subcategory is null;
update products set subcategory = 'Skirts'     where category = 'skirts'     and subcategory is null;
update products set subcategory = 'Dresses'    where category = 'dresses'    and subcategory is null;
update products set subcategory = 'Jumpsuits'  where category = 'jumpsuits'  and subcategory is null;
update products set subcategory = 'Bags'       where category = 'bags'       and subcategory is null;

-- PostgREST answers writes from a cached schema and reports an unknown column
-- as "Could not find the 'subcategory' column of 'products' in the schema
-- cache". It normally reloads on DDL; this makes it immediate.
notify pgrst, 'reload schema';
