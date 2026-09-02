-- Per-domain retailer rules.
--
-- A product's "where to buy" row gets its store name from the link's host, and
-- its "official store" flag from a guess (does the host contain the brand?).
-- Both are wrong often enough to matter: the bookmarklet imports a page from a
-- shop whose host does not read as its name, or from a brand's own site whose
-- host does not contain the brand string, and the row lands mislabelled with no
-- way to correct it except product by product.
--
-- This table is the correction, kept once per domain instead of once per
-- product: give the domain a name and say whether it is the brand's own shop,
-- and every future import from that domain is labelled from here.
--
-- Idempotent: safe to re-run.

create table if not exists public.retailer_domains (
  -- Bare host, lowercase, no "www." — e.g. "farfetch.com". Primary key, so a
  -- domain can only have one rule and an upsert is the natural write.
  domain      text primary key,
  name        text not null,
  is_official boolean not null default false,
  note        text,
  updated_at  timestamptz default now()
);

alter table public.retailer_domains enable row level security;
