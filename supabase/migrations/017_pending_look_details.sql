-- Migration 017: let a submitted look carry what it is called.
--
-- The publication pipeline already worked end to end — a shopper builds a look,
-- submits it, an admin approves it, and an outfit appears in the catalogue — but
-- it threw away everything that made the look someone's. `pending_looks` had
-- columns for the generated image, the pieces, the price and the style tags, and
-- none for a name or a description. So the approval step had nothing to write
-- and filled the gap with constants:
--
--     name: "Community Look",
--     description: "",
--     occasion: "casual",
--     season: "all",
--
-- Every community outfit in the catalogue therefore carried the same name and no
-- description. That is the "нельзя настроить" complaint at its source: there was
-- nothing to configure, because the fields did not exist.
--
-- All four are nullable. A look submitted before this migration, or by a shopper
-- who did not fill anything in, still approves — the approval step falls back to
-- the same constants as before, so nothing that worked stops working.

alter table public.pending_looks
  add column if not exists name        text,
  add column if not exists description text,
  add column if not exists occasion    text,
  add column if not exists season      text;

-- Approved rows already in the catalogue keep their placeholder name; nothing is
-- rewritten here, because guessing a name for someone else's look is worse than
-- leaving an admin to edit it.

notify pgrst, 'reload schema';
