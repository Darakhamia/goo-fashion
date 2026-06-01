-- Migration 006: Full-text search for products
-- Uses a trigger instead of a generated column to avoid the immutability constraint.

-- Add regular tsvector column
alter table products
  add column if not exists fts tsvector;

-- GIN index for fast FTS queries
create index if not exists products_fts_idx on products using gin(fts);

-- Function that recomputes FTS for a product row
create or replace function products_fts_update()
returns trigger as $$
begin
  new.fts := to_tsvector('english',
    coalesce(new.name, '')        || ' ' ||
    coalesce(new.brand, '')       || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(new.category, '')    || ' ' ||
    coalesce(array_to_string(new.style_keywords, ' '), '')
  );
  return new;
end;
$$ language plpgsql;

-- Trigger: keep fts in sync on every insert / update
drop trigger if exists products_fts_trigger on products;
create trigger products_fts_trigger
  before insert or update on products
  for each row execute function products_fts_update();

-- Backfill existing rows
update products
set fts = to_tsvector('english',
  coalesce(name, '')        || ' ' ||
  coalesce(brand, '')       || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(category, '')    || ' ' ||
  coalesce(array_to_string(style_keywords, ' '), '')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- search_products: ranked full-text search, falls back to recency if no match
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function search_products(
  query_text      text,
  match_count     int     default 30,
  filter_category text    default null,
  max_price_usd   numeric default null
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
      order by p.created_at desc
      limit match_count;
  end if;
end;
$$;
