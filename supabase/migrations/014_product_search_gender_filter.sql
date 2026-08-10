-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014: gender filtering in product retrieval
--
-- Both search functions could filter by category and price but NOT by gender,
-- so the AI stylist had no way to keep menswear out of a woman's results. That
-- was invisible while the catalog was 314 menswear items against 3 womenswear:
-- everything returned was menswear anyway. The moment the womenswear feed lands
-- (Б8-2) it stops being invisible and starts recommending dresses to men.
--
-- Semantics deliberately mirror the browse grid (src/app/browse/page.tsx:356-358)
-- so the stylist and the catalog agree on what a gender filter means:
--
--     show a product when  no gender is set on it        (unknown → keep)
--                      or  its gender matches the user
--                      or  it is unisex
--
-- Keeping untagged products visible matters: most of the existing catalog has
-- gender = null, and excluding those would empty the stylist instead of
-- filtering it. Passing filter_gender => null preserves the old behaviour
-- exactly, so this migration is backwards compatible for every caller.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the 4-argument versions FIRST. `create or replace` does not replace a
-- function when the argument list changes — it adds an overload, and PostgREST
-- then cannot resolve a 2-named-argument call between two candidates:
--   ERROR: function search_products(query_text => unknown, match_count => integer) is not unique
-- which would break every existing stylist search the moment this is applied.
drop function if exists match_products(vector, int, text, numeric);
drop function if exists search_products(text, int, text, numeric);

-- Normalise legacy empty-string genders to null so every retrieval path agrees
-- on one representation of "unknown". The RPCs below tolerate both, but the
-- direct PostgREST queries in the stylist filter on `gender.is.null`, and an
-- empty string would drop those rows out of the catalog for a filtered user.
update products set gender = null where gender = '';

-- ── Semantic search (pgvector) ───────────────────────────────────────────────
create or replace function match_products(
  query_embedding vector(1536),
  match_count     int     default 30,
  filter_category text    default null,
  max_price_usd   numeric default null,
  filter_gender   text    default null
)
returns table (
  id            text,
  name          text,
  brand         text,
  category      text,
  price_min     numeric,
  style_keywords text[],
  description   text,
  similarity    float
)
language plpgsql
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.brand,
    p.category,
    p.price_min,
    p.style_keywords,
    p.description,
    1 - (p.embedding <=> query_embedding) as similarity
  from products p
  where
    p.embedding is not null
    and (filter_category is null or p.category = filter_category)
    and (max_price_usd   is null or p.price_min <= max_price_usd)
    and (
      filter_gender is null
      or p.gender is null
      or p.gender = ''
      or p.gender = filter_gender
      or p.gender = 'unisex'
    )
  order by p.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ── Full-text search ─────────────────────────────────────────────────────────
create or replace function search_products(
  query_text      text,
  match_count     int     default 30,
  filter_category text    default null,
  max_price_usd   numeric default null,
  filter_gender   text    default null
)
returns table (
  id             text,
  name           text,
  brand          text,
  category       text,
  price_min      numeric,
  style_keywords text[],
  description    text,
  rank           float
)
language plpgsql
as $$
declare
  tsq tsquery;
begin
  begin
    tsq := plainto_tsquery('english', query_text);
  exception when others then
    tsq := null;
  end;

  if tsq is not null and query_text != '' then
    return query
      select
        p.id, p.name, p.brand, p.category, p.price_min,
        p.style_keywords, p.description,
        ts_rank(p.fts, tsq)::float as rank
      from products p
      where
        p.fts @@ tsq
        and (filter_category is null or p.category = filter_category)
        and (max_price_usd   is null or p.price_min <= max_price_usd)
        and (
          filter_gender is null
          or p.gender is null
          or p.gender = ''
          or p.gender = filter_gender
          or p.gender = 'unisex'
        )
      order by rank desc
      limit match_count;
  end if;

  -- Fallback: no FTS match or empty query → return most recent products
  if not found or tsq is null or query_text = '' then
    return query
      select
        p.id, p.name, p.brand, p.category, p.price_min,
        p.style_keywords, p.description,
        0.0::float as rank
      from products p
      where
        (filter_category is null or p.category = filter_category)
        and (max_price_usd is null or p.price_min <= max_price_usd)
        and (
          filter_gender is null
          or p.gender is null
          or p.gender = ''
          or p.gender = filter_gender
          or p.gender = 'unisex'
        )
      order by p.created_at desc
      limit match_count;
  end if;
end;
$$;

-- Index supporting the gender predicate on large catalogs. Partial: rows with
-- no gender are matched by the `is null` branch and never need the index.
create index if not exists products_gender_idx on products (gender) where gender is not null;
