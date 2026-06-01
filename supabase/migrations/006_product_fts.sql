-- Migration 006: Full-text search for products (replaces vector embeddings for catalog search)
-- Simpler, faster, no external API dependency. Works out of the box with Supabase.

-- Add FTS column (generated, always in sync with product data)
alter table products
  add column if not exists fts tsvector
  generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(brand, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(array_to_string(style_keywords, ' '), '')
    )
  ) stored;

-- GIN index for fast FTS queries
create index if not exists products_fts_idx on products using gin(fts);

-- ─────────────────────────────────────────────────────────────────────────────
-- search_products: full-text search returning ranked product results
-- Falls back to returning all products if query is empty/too short
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function search_products(
  query_text      text,
  match_count     int     default 30,
  filter_category text    default null,
  max_price_usd   numeric default null
)
returns table (
  id            text,
  name          text,
  brand         text,
  category      text,
  price_min     numeric,
  style_keywords text[],
  description   text,
  rank          float
)
language plpgsql
as $$
declare
  tsq tsquery;
begin
  -- Try to build a tsquery from the input; fall back to null if it fails
  begin
    tsq := plainto_tsquery('english', query_text);
  exception when others then
    tsq := null;
  end;

  -- If we have a valid query, return ranked FTS results
  if tsq is not null and query_text != '' then
    return query
    select
      p.id,
      p.name,
      p.brand,
      p.category,
      p.price_min,
      p.style_keywords,
      p.description,
      ts_rank(p.fts, tsq)::float as rank
    from products p
    where
      p.fts @@ tsq
      and (filter_category is null or p.category = filter_category)
      and (max_price_usd   is null or p.price_min <= max_price_usd)
    order by rank desc
    limit match_count;

    -- If FTS returned nothing, fall through to full scan
    if not found then
      return query
      select
        p.id, p.name, p.brand, p.category, p.price_min,
        p.style_keywords, p.description, 0.0::float as rank
      from products p
      where
        (filter_category is null or p.category = filter_category)
        and (max_price_usd is null or p.price_min <= max_price_usd)
      order by p.created_at desc
      limit match_count;
    end if;
  else
    -- Empty query → return most recent products
    return query
    select
      p.id, p.name, p.brand, p.category, p.price_min,
      p.style_keywords, p.description, 0.0::float as rank
    from products p
    where
      (filter_category is null or p.category = filter_category)
      and (max_price_usd is null or p.price_min <= max_price_usd)
    order by p.created_at desc
    limit match_count;
  end if;
end;
$$;
