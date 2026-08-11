-- ============================================================================
-- Retag blog posts onto the Journal taxonomy in src/lib/blog-categories.ts
--
-- NOT REQUIRED. The Journal filter derives its chips from the categories that
-- actually exist, ranking known ones first, so posts left on the old values stay
-- reachable — they just show up as a chip outside the new taxonomy. Run this
-- when you want the feed to read cleanly, not to make it work.
--
-- Two values from the previous list have no home in the new one:
--
--   "How-to"  → "Style Guide"      same job, one name
--   "News"    → "Trends"           the existing News posts are fashion reporting,
--                                  not product news. "Product Updates" is for
--                                  things GOO itself shipped, so News must NOT
--                                  be swept there — check the rows first.
--
-- Review before running:
--   select category, count(*), min(title) from public.blog_posts group by 1;
-- ============================================================================

begin;

update public.blog_posts set category = 'Style Guide' where category = 'How-to';

-- Read the titles this touches before you commit; if any "News" post is really
-- about GOO rather than about fashion, move that row to 'Product Updates' or
-- 'Announcements' by hand instead.
update public.blog_posts set category = 'Trends' where category = 'News';

-- Anything still off-taxonomy after the two statements above.
select category, count(*) as posts
from public.blog_posts
where category not in (
  'Trends', 'Style Guide', 'Brands', 'Smart Shopping',
  'Product Updates', 'AI Stylist', 'Announcements'
)
group by category
order by posts desc;

commit;
