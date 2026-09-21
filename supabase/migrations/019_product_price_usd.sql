-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019: one comparable price scale
--
-- The catalogue stores a price in whatever the store charges in, which is
-- correct and stays that way: showing a hryvnia price as dollars is a lie about
-- the product. But every comparison was made against the source number as if it
-- were already dollars. The parameter was even called `max_price_usd`:
--
--     and (max_price_usd is null or p.price_min <= max_price_usd)
--
-- so "under $200" matched a 4 000 ₴ jacket (about $90 — it should match) by
-- comparing 4000 <= 200 (it did not), and a 150 ₴ tee was excluded from a
-- $200 budget. The AI stylist's budget filter ran through the same functions and
-- was wrong in the same direction.
--
-- Fix: each row also carries its price on the USD scale, plus the rate that put
-- it there and the day that rate is from. Filtering and sorting use that scale;
-- display keeps using price_min with the row's own currency.
--
-- Why the rate is stored rather than applied at read time: a rate looked up
-- later silently changes yesterday's numbers, so the same query gives different
-- answers on different days and no result can be explained. With the rate and
-- its date beside the amount, any number can be traced.
--
-- ── Backfill policy (CEO decision, 2026-09-21) ───────────────────────────────
-- Existing rows get price_usd = price_min and are NOT re-currencied. Every row
-- imported so far was written as USD by the old default, so this preserves
-- exactly today's behaviour: right for the rows that really are dollars,
-- no worse than today for the rest. Re-deriving the true currency of historic
-- rows needs their source pages re-read and is a separate task.
--
-- Rows whose currency is already known to be non-USD (the CSV importer does
-- detect currency) are left with a NULL price_min_usd rather than a number this
-- migration would have to invent a rate for. Every reader coalesces NULL back to
-- price_min, so those rows behave exactly as they do today until an import
-- refreshes them with a real recorded rate.
-- ─────────────────────────────────────────────────────────────────────────────

alter table products add column if not exists price_min_usd numeric;
alter table products add column if not exists price_max_usd numeric;
alter table products add column if not exists fx_rate       numeric;
alter table products add column if not exists fx_date       date;

comment on column products.price_min_usd is
  'price_min on the USD scale. Used for filtering/sorting only; display uses price_min with currency.';
comment on column products.fx_rate is
  'Units of the row''s currency per one USD, as used at import time. 1 for USD.';
comment on column products.fx_date is
  'Day the fx_rate is attributed to, so a stored conversion can be explained later.';

-- Backfill: dollars keep their number and get an honest rate of 1. Anything
-- already flagged as another currency is deliberately left NULL.
update products
   set price_min_usd = price_min,
       price_max_usd = price_max,
       fx_rate       = 1,
       fx_date       = current_date
 where price_min_usd is null
   and (currency is null or currency = '' or upper(currency) = 'USD');

-- Sorting and range scans run on the comparable column.
create index if not exists products_price_min_usd_idx
  on products (price_min_usd)
  where price_min_usd is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Retrieval functions, republished against the comparable scale.
--
-- `coalesce(p.price_min_usd, p.price_min)` is the compatibility hinge: a row
-- that has not been re-imported since this migration keeps behaving exactly as
-- it does today rather than dropping out of the catalogue. It is not a second
-- guess at the currency — it is "no better information than before, yet".
--
-- Argument lists are unchanged, so every existing caller keeps working and
-- `create or replace` genuinely replaces rather than adding an overload (see
-- migration 014's note on why that distinction matters to PostgREST).
-- ─────────────────────────────────────────────────────────────────────────────

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
    and (max_price_usd   is null or coalesce(p.price_min_usd, p.price_min) <= max_price_usd)
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
        and (max_price_usd   is null or coalesce(p.price_min_usd, p.price_min) <= max_price_usd)
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
        and (max_price_usd is null or coalesce(p.price_min_usd, p.price_min) <= max_price_usd)
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
