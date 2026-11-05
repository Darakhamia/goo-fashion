-- Migration 033: what the AI stylist gets to choose from.
--
-- The stylist never sees the whole catalogue: each turn it is handed a short
-- list of candidates, and it can only recommend from that list. Until now the
-- list came from search_products (019), which reads the shopper's sentence with
-- plainto_tsquery — every word of it must be in one product. A real request
-- ("smart casual for the office, XXL, nothing flashy"; "Our Legacy / Lemaire,
-- relaxed tailoring") never has all its words in one product, so the search
-- matched nothing and fell back to "the 30 newest products". On 2026-11-05 the
-- 30 newest products were all New Rock boots imported on 1 November, and the
-- stylist told shoppers "we only have footwear" and offered a 62-year-old a
-- men's platform boot with a metal skull.
--
-- stylist_candidates replaces that list:
--
--   * the words of the request are OR-ed and ranked, so a product that matches
--     more of them comes first, instead of nothing matching at all;
--   * at most `per_brand` pieces of one brand per category, and the categories
--     take turns, so one brand with thousands of rows cannot fill the list;
--   * the categories the shopper named, the subcategories to prefer
--     (Hoodies, Jeans, Dresses…), their gender and budget narrow it;
--   * products without a price are left out — the stylist cannot sell a $0
--     jacket and should not show one;
--   * within each category the pieces that match the words come first, and
--     the category's remaining places go to pieces that fit the filters, so a
--     category the words missed is still there to choose from — never "the
--     newest products".
--
-- search_products and match_products are not touched: the stylist falls back
-- to them while this function does not exist, and nothing else changes.
--
-- Changes no existing data. Idempotent: safe to re-run.

create or replace function stylist_candidates(
  query_text           text    default null,
  match_count          int     default 48,
  filter_categories    text[]  default null,
  prefer_subcategories text[]  default null,
  max_price_usd        numeric default null,
  filter_gender        text    default null,
  per_category         int     default 8,
  per_brand            int     default 3
)
returns table (
  id             text,
  name           text,
  brand          text,
  category       text,
  subcategory    text,
  gender         text,
  price_min      numeric,
  price_usd      numeric,
  style_keywords text[],
  description    text,
  rank           float
)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
  tsq   tsquery;
  terms text;
begin
  -- The request's own lexemes, OR-ed. to_tsvector drops stopwords and stems
  -- ("hoodies" → "hoodi"); the lexemes are already stemmed, so they are joined
  -- under the 'simple' config rather than stemmed a second time.
  if query_text is not null and btrim(query_text) <> '' then
    select string_agg(quote_literal(lex), ' | ')
      into terms
      from unnest(tsvector_to_array(to_tsvector('english', query_text))) as lex;
    if terms is not null then
      begin
        tsq := to_tsquery('simple', terms);
      exception when others then
        tsq := null;
      end;
    end if;
  end if;

  -- Within each category, pieces that match the words come first, best match
  -- first; the rest of the category's places go to pieces that fit the
  -- filters without matching. So a look for a date in which the words found
  -- only jeans and hoodies still gets shoes and a jacket to choose from.
  return query
    with pool as (
      select
        p.id, p.name, p.brand, p.category, p.subcategory, p.gender,
        p.price_min,
        coalesce(p.price_min_usd, p.price_min) as price_usd,
        p.style_keywords, p.description,
        (tsq is not null and coalesce(p.fts @@ tsq, false)) as matched,
        (case when tsq is null then 0.0 else ts_rank(p.fts, tsq) end)::float as rank,
        coalesce(p.subcategory = any(prefer_subcategories), false) as preferred
      from products p
      where coalesce(p.price_min_usd, p.price_min, 0) > 0
        and (filter_categories is null or p.category = any(filter_categories))
        and (max_price_usd is null or coalesce(p.price_min_usd, p.price_min) <= max_price_usd)
        and (
          filter_gender is null
          or p.gender is null
          or p.gender = ''
          or p.gender = filter_gender
          or p.gender = 'unisex'
        )
    ),
    by_brand as (
      select
        pool.*,
        row_number() over (
          partition by pool.category, lower(coalesce(pool.brand, ''))
          order by pool.matched desc, pool.preferred desc, pool.rank desc, md5(pool.id)
        ) as brand_n
      from pool
    ),
    by_category as (
      select
        b.*,
        row_number() over (
          partition by b.category
          order by b.matched desc, b.preferred desc, b.rank desc, md5(b.id)
        ) as cat_n
      from by_brand b
      where b.brand_n <= per_brand
    )
    select
      c.id, c.name, c.brand, c.category, c.subcategory, c.gender,
      c.price_min, c.price_usd, c.style_keywords, c.description, c.rank
    from by_category c
    where c.cat_n <= per_category
    -- Categories take turns: every category's best piece before any
    -- category's second, so a long list of one kind cannot crowd out the rest.
    order by c.cat_n, c.matched desc, c.preferred desc, c.rank desc, md5(c.id)
    limit match_count;
end;
$$;

notify pgrst, 'reload schema';
