# What comes from the app

## The promo (`src/promo/`): captures only

The promo draws no interface. Every piece of UI in it is a screenshot of the real app, running locally on fixtures and captured with Playwright at deviceScaleFactor 2. The captures are `public/captures/*.png`, with their geometry in `public/captures/manifest.json`. See `capture/` and STORYBOARD.md §1.

The device frames around the captures (`src/promo/Device.tsx`, a phone bezel and a browser window) are presentation, not the app's UI.

## The portrait card (`src/card/`): rebuilt pieces

The portrait card (`out/card/`, made 2026-10-12) predates the capture pipeline. It still uses two pieces rebuilt from the app's markup, at `4840928`.

| File | From |
|---|---|
| `src/ui/app/BuilderBoard.tsx` | `src/app/builder/page.tsx:2034-2170`, the board (collage canvas) |
| `src/ui/app/MobileBuilder.tsx` | `src/app/builder/page.tsx:1992-2338` and `src/components/layout/MobileBottomNav.tsx` |

- Their JSX and Tailwind classes are copied from the lines named in each file's header. Only their state comes from the frame.
- They need two more things from the app:
  - `src/vendor/lib/types.ts` is copied verbatim from `src/lib/types.ts` (`Product`, `Retailer`…).
  - `src/shims/currency-context.tsx` formats US dollars as the app's `applyFormat()` does.
- `src/styles/app.css` copies the theme, motion and colour tokens from `src/app/globals.css` verbatim, between BEGIN/END markers.
- The card's photos are `public/fixtures/products/`.

The first cut of the video used more rebuilt pieces (browse page, look panel, stylist sheet, product page, hero). They were removed when the promo replaced it, and remain in git history.
