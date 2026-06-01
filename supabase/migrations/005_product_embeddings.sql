-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005: Product vector embeddings for AI Stylist semantic search
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgvector extension (safe to run multiple times)
create extension if not exists vector;

-- Add embedding column to products table
-- 1024 dimensions = BGE-large-en-v1.5 model (nateraw/bge-large-en-v1.5 on Replicate)
alter table products
  add column if not exists embedding vector(1024);

-- HNSW index for fast approximate nearest-neighbour cosine search
-- No minimum row requirement (unlike IVFFlat) — works on any table size
create index if not exists products_embedding_hnsw_idx
  on products using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ─────────────────────────────────────────────────────────────────────────────
-- match_products: find the most semantically similar products to a query vector
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function match_products(
  query_embedding vector(1024),
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
