# What comes from the app

The video draws GOO's real interface. Nothing in the app was changed: files were
copied from the repository at `4840928` (master, 2026-10-12).

## Copied verbatim — `src/vendor/`

Byte-for-byte copies, kept at their app paths so their own `@/…` imports resolve
(`@` → `src/vendor`, see `remotion.config.ts`).

| File | From |
|---|---|
| `components/product/ProductCard.tsx` | `src/components/product/ProductCard.tsx` — the browse grid's card |
| `components/product/ProductImage.tsx` | `src/components/product/ProductImage.tsx` |
| `components/ui/Image.tsx` | `src/components/ui/Image.tsx` |
| `lib/image.ts` | `src/lib/image.ts` (`photoBackdrop` and friends) |
| `lib/variant-display.ts` | `src/lib/variant-display.ts` |
| `lib/hooks/useHoverImageCycle.tsx` | `src/lib/hooks/useHoverImageCycle.tsx` |
| `lib/cart-item.ts` | `src/lib/cart-item.ts` |
| `lib/types.ts` | `src/lib/types.ts` (`Product`, `Retailer`, …) |

## Shims — `src/shims/`

What the copied files import but a video can't have, swapped by alias:

| Module | Shim |
|---|---|
| `next/link` | a plain `<a>` |
| `next/image` | Remotion's `<Img>` (each frame waits for its photos) |
| `framer-motion` | the element's plain tag in its settled state; the video animates from the frame number instead |
| `@/lib/context/currency-context` | US dollars, formatted as the app's `applyFormat()` formats USD |
| `@/lib/context/likes-context`, `auth-context`, `cart-context` | a signed-out visitor with an empty bag |

## Rebuilt from the app's markup — `src/ui/app/`

Page-level pieces hold their state in `useState` and fetch live data, so they
can't be mounted as they are. Their JSX and Tailwind classes are copied from
the lines named in each file's header; only the state comes from the frame:

| File | From |
|---|---|
| `HeroGroup.tsx` | `src/components/home/HeroSection.tsx`, `ui/gooey-text-morphing.tsx` (the settled word) |
| `EtherealShadow.tsx` | `src/components/ui/etheral-shadow.tsx` — same keyframes, evaluated per frame |
| `BrowsePage.tsx` | `src/app/browse/BrowseClient.tsx` — header, toolbar, `ActiveChip`, grid |
| `BuilderBoard.tsx` | `src/app/builder/page.tsx:2034-2170` — the board (collage canvas) |
| `LookPanel.tsx` | `src/app/builder/page.tsx:1692-1985` — "In this look" |
| `SlotIcon.tsx` | `src/app/builder/page.tsx:111-137`, unchanged |
| `StylistSheet.tsx` | `src/components/stylist/StylistDrawer.tsx:667-1040`, phone styles |
| `ProductPage.tsx` | `src/components/product/ProductClient.tsx` — gallery, info, "Where to buy" |
| `MobileBuilder.tsx` | `src/app/builder/page.tsx:1992-2338` + `src/components/layout/MobileBottomNav.tsx` |

Responsive classes are resolved to the branch the scene shows. The video frame
is always wider than `md`, so a phone-styled piece carries its phone classes
only.

## Styles

`src/styles/app.css` copies the theme curves, motion tokens, colour tokens
(light and `.dark`), `body` and `.no-scrollbar` from `src/app/globals.css`
verbatim, between BEGIN/END markers. Inter Tight comes from `@fontsource`.
