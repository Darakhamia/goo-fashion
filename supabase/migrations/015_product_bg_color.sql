-- Migration 015: Remember the colour a product photo sits on.
--
-- Catalog photos come from a dozen retailers, and every retailer shoots on its
-- own backdrop — pure white, off-white, a warm grey, a pale studio beige. The
-- card renders them `object-contain` inside a fixed 3:4 box, so a photo whose
-- aspect ratio does not match gets padding on two sides. That padding is the
-- card's own background, which means a photo shot on #f2efe9 sits inside a
-- white frame with a visible seam down both edges.
--
-- The fix is to pad with the photo's own backdrop instead. That colour cannot
-- be read in the browser: partner-CDN photos render `unoptimized` and are
-- cross-origin, so a canvas that draws one is tainted and refuses to be read.
-- It has to be measured server-side, once, and stored.
--
-- Three states, not two:
--
--   NULL        not measured yet
--   'none'      measured, and the photo has no single backdrop — a lifestyle
--               shot, a transparent cutout, a photo that bleeds to all four
--               edges. Keeps the current behaviour, which is the right one for
--               those: there is no one colour that would be correct.
--   '#rrggbb'   the colour its four corners agreed on
--
-- 'none' exists so a re-run is cheap. With only NULL to mean both "untouched"
-- and "declined", every pass would re-download every photo it had already
-- judged, forever — on a catalogue of thousands that is the difference between
-- a job that finishes and one that never does.

-- Deliberately four plain statements: no DO block, no dollar-quoting, nothing
-- that needs a heredoc to reach a database. Migration 013 could assume a real
-- psql session; this one gets pasted into whatever SQL box is to hand — a web
-- terminal, Studio, `docker exec` — and `$$` is exactly what those mangle.
-- drop-then-add keeps it re-runnable without an exception handler.

alter table public.products
  add column if not exists bg_color text;

-- The column is read into a `style` attribute, so its shape is guarded here as
-- well as in the code that renders it. A bad import cannot put CSS in front of
-- a shopper if the database will not store it.
alter table public.products
  drop constraint if exists products_bg_color_shape;

alter table public.products
  add constraint products_bg_color_shape
  check (bg_color is null or bg_color = 'none' or bg_color ~* '^#[0-9a-f]{6}$');

-- No embedded quotes in this comment on purpose, for the same paste-safety
-- reason as above.
comment on column public.products.bg_color is
  'Backdrop behind the product photo where object-contain leaves padding: #rrggbb sampled from the four corners of the image, the literal none when they disagreed, NULL when not yet measured.';

-- Without this PostgREST keeps serving from a schema cache that has never heard
-- of the column, and the API answers "column products.bg_color does not exist"
-- while the column plainly exists.
notify pgrst, 'reload schema';
