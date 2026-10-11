-- Migration 027: when a product or an outfit last changed.
--
-- sitemap.xml gives Google a <lastmod> per page so it recrawls what changed and
-- leaves the rest alone. Products and outfits had only created_at, so a price
-- or description edit never showed there (docs/SEO_PLAN.md, SEO-14).
--
--   products.updated_at, outfits.updated_at
--     Set on insert, moved forward by a trigger on every update that changes
--     what the page shows. Bookkeeping columns don't count: the search
--     embedding and the catalogue check's fingerprint are rewritten in bulk by
--     admin jobs, and a lastmod that moves for the whole catalogue at once tells
--     Google nothing.
--
-- Existing rows start at their created_at: the best known date of their last
-- change. Only the new column is filled; no existing value is touched.
--
-- Idempotent: safe to re-run.

alter table public.products add column if not exists updated_at timestamptz;
update public.products set updated_at = created_at where updated_at is null;
alter table public.products alter column updated_at set default now();
alter table public.products alter column updated_at set not null;

alter table public.outfits add column if not exists updated_at timestamptz;
update public.outfits set updated_at = created_at where updated_at is null;
alter table public.outfits alter column updated_at set default now();
alter table public.outfits alter column updated_at set not null;

create or replace function public.goo_touch_updated_at()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'embedding' - 'catalogue_fingerprint' - 'catalogue_checked_at')
     is distinct from
     (to_jsonb(old) - 'updated_at' - 'embedding' - 'catalogue_fingerprint' - 'catalogue_checked_at') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.goo_touch_updated_at();

drop trigger if exists outfits_touch_updated_at on public.outfits;
create trigger outfits_touch_updated_at
  before update on public.outfits
  for each row execute function public.goo_touch_updated_at();
