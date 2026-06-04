-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007: Switch product embeddings to OpenAI text-embedding-3-small
-- (1536 dims). OpenAI embeddings have no cold start, unlike the Replicate-hosted
-- BGE model (migration 005) which scaled to zero and stalled live chat.
--
-- ⚠️ This drops all existing 1024-dim embeddings — re-run POST /api/admin/embeddings
--    after applying to repopulate them at 1536 dims.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old HNSW index and 1024-dim column, recreate at 1536.
drop index if exists products_embedding_hnsw_idx;
alter table products drop column if exists embedding;
alter table products add column embedding vector(1536);

-- HNSW index for fast approximate nearest-neighbour cosine search.
create index if not exists products_embedding_hnsw_idx
  on products using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Recreate match_products against the 1536-dim column.
create or replace function match_products(
  query_embedding vector(1536),
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
  order by p.embedding <=> query_embedding
  limit match_count;
end;
$$;
