-- Migration 012: Remember which audit suggestions have been rejected.
--
-- The audit argues from patterns, so some of what it says is wrong: "Bomber
-- Jackets" is more precise than the "Jackets" a rule suggests, and a rule that
-- learned "smith" from Stan Smith trainers will argue that a Paul Smith shirt
-- is footwear. Without somewhere to record that judgement, every re-run
-- repeats it and the real findings drown.
--
-- A dismissal is about one specific claim rather than one product: the
-- product, the field, what it holds and what was suggested. If the stored
-- value later changes, the old claim no longer applies and the audit is free
-- to raise the new one — which is the point of keying on all four.

create table if not exists public.label_audit_dismissals (
  id           bigserial   primary key,
  product_id   text        not null references public.products (id) on delete cascade,
  field        text        not null,   -- 'category', 'subcategory', 'gender', 'colour group'
  stored       text        not null default '',
  suggested    text        not null default '',
  dismissed_by text,
  created_at   timestamptz not null default now(),
  unique (product_id, field, stored, suggested)
);

create index if not exists label_audit_dismissals_product_idx
  on public.label_audit_dismissals (product_id);

alter table public.label_audit_dismissals enable row level security;
-- No public read policy: this is admin bookkeeping, reached only through the
-- service role key server-side.

notify pgrst, 'reload schema';
