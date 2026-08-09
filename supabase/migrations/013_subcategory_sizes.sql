-- Migration 013: Give each subcategory its own size chart.
--
-- Size charts were a table in the admin's code, keyed by the stored category.
-- That is too coarse to be right: Belts, Hats, Sunglasses and Watches are all
-- `accessories`, so all four offered "One Size" — though a belt has real sizes
-- and a watch does not. It was also a dead end, because a subcategory added in
-- the admin panel got whatever its bucket happened to carry, and a new bucket
-- got nothing at all.
--
-- The chart belongs to the subcategory, which is the level that actually knows
-- how a thing is sized. Editing one is then an admin action rather than a
-- deploy, the same as the rest of the tree.
--
-- Nullable on purpose: a subcategory with no chart falls back to the code's
-- table, so nothing changes until a chart is filled in.

alter table public.category_subcategories
  add column if not exists size_type text,
  add column if not exists sizes     text[];

-- Seed from the table this replaces, so every subcategory starts with what its
-- products were already being offered.
update public.category_subcategories s
set size_type = p.size_type,
    sizes     = p.sizes
from (values
  ('tops',        'letter',   array['XXS','XS','S','M','L','XL','XXL','XXXL']),
  ('shirts',      'letter',   array['XXS','XS','S','M','L','XL','XXL']),
  ('knitwear',    'letter',   array['XS','S','M','L','XL','XXL']),
  ('bottoms',     'letter',   array['XS','S','M','L','XL','XXL']),
  ('jeans',       'number',   array['24','25','26','27','28','29','30','31','32','33','34','36','38']),
  ('shorts',      'letter',   array['XS','S','M','L','XL','XXL']),
  ('skirts',      'letter',   array['XS','S','M','L','XL']),
  ('outerwear',   'letter',   array['XS','S','M','L','XL','XXL']),
  ('blazers',     'letter',   array['XS','S','M','L','XL','XXL']),
  ('dresses',     'letter',   array['XS','S','M','L','XL','XXL']),
  ('jumpsuits',   'letter',   array['XS','S','M','L','XL','XXL']),
  ('footwear',    'eu',       array['35','36','37','38','39','40','41','42','43','44','45','46']),
  ('accessories', 'one-size', array['One Size','XS/S','S/M','M/L','L/XL']),
  ('bags',        'one-size', array['One Size']),
  ('swimwear',    'letter',   array['XS','S','M','L','XL'])
) as p (value, size_type, sizes)
where s.value = p.value and s.size_type is null;

-- The corrections the old granularity could not express. A watch is one size;
-- a belt is not; sunglasses and hats sit in between and keep the generic
-- fallback rather than being given a wrong answer confidently.
update public.category_subcategories set size_type = 'number',
       sizes = array['70','75','80','85','90','95','100','105','110']
where label = 'Belts';

update public.category_subcategories set size_type = 'one-size', sizes = array['One Size']
where label in ('Watches', 'Sunglasses', 'Bags');

notify pgrst, 'reload schema';
