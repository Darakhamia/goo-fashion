# GOO Fashion: portfolio loop, storyboard and plan

A 24-second silent loop of the GOO interface for a portfolio site. It is built with Remotion in this folder only: it has its own `package.json`, and nothing in the app's code or dependencies changes. Status: **approved 2026-10-12**, decisions in §4; what changed while building is in §5.

---

## 1. What the repo allows (and what it doesn't)

Checked against the code at `4840928`.

| Finding | Consequence for the video |
|---|---|
| Page components (`builder/page.tsx` 3,102 lines, `BrowseClient.tsx` 2,107, `StylistDrawer.tsx` 1,056, `ProductClient.tsx` 818) depend on `next/link`, `next/image`, `next/navigation`, Clerk, and contexts that fetch live data (`currency-context` → `/api/exchange-rates`, the stylist → `/api/stylist/chat`). | They can't be mounted as-is without a server. |
| Motion in the app is wall-clock: framer-motion, CSS `@keyframes` (`EtherealShadow`, `dot-bounce`) and a `requestAnimationFrame` loop (`GooeyText`). | Remotion renders frame by frame. Wall-clock animation would land on random in-between states, so all motion has to be driven by `useCurrentFrame()`. |
| Tokens live in `src/app/globals.css`: dark theme under `.dark` (`--background #0A0A0A`, `--surface #141414`, `--foreground #F0EEE8`, `--border #222220`…). Easing tokens: `--ease-out cubic-bezier(.23,1,.32,1)`, `--ease-drawer cubic-bezier(.32,.72,0,1)`. Fonts: Inter Tight (body and display), Poppins 800 (nav wordmark). | Use them verbatim: the same CSS variables, the same curves, the same fonts. |
| The seed catalogue (`src/lib/data/products.ts`, 24 items; `outfits.ts`) has rich multi-store pricing: 2–3 retailers per item with different prices, which suits "Best price, found". | Good source for names, brands, prices and stores. |
| **The seed photos are a problem.** All 38 are Unsplash links. **4 of 24 product images are dead (404:** p-002, p-010, p-011, p-019). Many don't match the product: "Linen Shirt" (p-008) is a Chanel perfume bottle, "Oversized Wool Coat" (p-001) is a bomber, p-023 is a landscape. All are lifestyle shots on mixed backgrounds, not the site's white product cards. | **See D1.** As-is, they would make the video look unlike the real site. |

### Approach: real UI, frame-driven

1. **Vendored leaf components, unchanged.**
   - Which: presentational pieces such as `ProductCard`, `ProductImage`, `OutfitCollage`, `Price`, the retailer logo, plus the `lib/` helpers they need. The final list is settled while building.
   - How: copied byte-for-byte into `src/vendor/` and recorded in `VENDORED.md` with source path and commit.
   - They run through small shims, picked by webpack alias in `remotion.config.ts`:
     - `next/link` → `<a>`, `next/image` → `<img>`;
     - Clerk and the contexts → fixture values;
     - `framer-motion` → renders the settled `animate` state.
2. **Page layouts rebuilt from the same markup.**
   - Which: the desktop nav pill, the hero, the browse header and toolbar with `ActiveChip`, the builder catalogue plus "In this look" panel, the stylist drawer (bubbles, product tiles, "Build this look" card), the "Where to buy" rows with the `Best` badge, and the mobile builder board and bottom nav.
   - How: the JSX and Tailwind classes are copied from the source lines, but their state comes from the frame number instead of `useState` and fetches.
   - Each file names its source in a header comment, e.g. `// from src/app/builder/page.tsx:1692`.
3. **Tokens and styles.** The token blocks of `globals.css` are copied in. Tailwind v4 runs through `@remotion/tailwind-v4`. The composition root carries `className="dark"`.
4. **Data and offline rendering.** Everything comes from `src/fixtures/*.ts`. Images are local files under `public/fixtures/`. No network at render time: no API, no LLM, no Google Fonts (fonts come from `@fontsource` packages).

---

## 2. Storyboard

24.0 s · 30 fps · 720 frames. All times are in seconds.

| # | Time | Scene | What moves | Caption |
|---|---|---|---|---|
| 0 | 0.0 | **Loop seam (= last frame)** | Frame 0 is the finished end card: black, the big "GOO", "Your look, found and priced.", "goo-fashion.com". It is also the poster. | — |
| 1 | 0.0–3.0 | **Home hero** | <ul><li>0.0–0.8: the tagline and URL fade and drift 8 px down. "Build your look" and the CTA rise in beneath the same "GOO", which never moves. The nav pill settles from −12 px. The `EtherealShadow` blobs and grain fade in, now driven by the frame.</li><li>Slow push-in 1.00 → 1.03 over the scene.</li><li>2.2: the CTA gets a soft press (scale 1 → 0.97 → 1 over 160 ms, the site's `--dur-press`).</li></ul> | — |
| 2 | 3.0–7.0 | **Browse** | <ul><li>The hero lifts out (−24 px, fade). The browse page rises in: the "BROWSE" display title, then the Filter/Search toolbar and the Pieces/Outfits switch.</li><li>The white-card grid scrolls about 1.5 rows with an ease-in-out glide.</li><li>At 5.2 an `ActiveChip` switches "Outerwear" → "Footwear". The grid re-deals with a 40 ms stagger of fade-up cards.</li></ul> | Browse every store |
| 3 | 7.0–11.5 | **Outfit builder** | <ul><li>The real builder layout: chips row, catalogue, "In this look" panel.</li><li>Five picks, 0.6 s apart. On each: the card gets its selected ring and check, the matching slot fills with a soft spring (y −10 → 0, scale 0.97 → 1), "N pieces" ticks up, and **TOTAL counts up** to the full price.</li><li>Push-in toward the panel (1.00 → 1.06, anchored right).</li></ul> | Build the look |
| 4 | 11.5–15.5 | **AI stylist** | <ul><li>The drawer slides in on `--ease-drawer` over the dimmed browse page.</li><li>"What's trending?" is typed into the field (about 0.7 s) and sent. The user bubble pops in, then three typing dots for 0.5 s.</li><li>The reply reveals word by word. Two product tiles pop in (120 ms stagger), then the "Build this look · 2 pieces · Opens in the builder" card slides up.</li><li>Push-in on the drawer.</li></ul> | Ask the AI stylist |
| 5 | 15.5–19.0 | **Product page** | <ul><li>Match cut from the chat's second tile to **the same item's** product page: the gallery image grows from the tile's spot.</li><li>"Where to buy" rows arrive with a stagger from 3 stores. The cheapest row then takes the `Best` badge and the highlighted border. "From $X" settles.</li></ul> | Best price, found |
| 6 | 19.0–21.5 | **Phone** | <ul><li>The product page recedes (scale 0.94, darkens).</li><li>An iPhone frame slides up with a subtle spring, showing the **mobile builder board**: the same pieces settle into the collage one by one, and "$N · 5 pieces" ticks.</li><li>The real mobile chrome: "New look" header and bottom nav with Builder active.</li></ul> | — |
| 7 | 21.5–24.0 | **End card** | <ul><li>The phone drops away. Black. The big "GOO" fades in where the hero has it.</li><li>"Your look, found and priced." then "goo-fashion.com" follow at a 150 ms stagger.</li><li>From 23.0 it holds still, so frame 719 is pixel-identical to frame 0.</li></ul> | — |

**Captions.** Bottom-left, 4 words at most, in English, in the site's dark tokens.
- Type: Inter Tight Medium, 30 px at 1080p, `--foreground`, with a 24 px hairline in front of it.
- Motion: in with a 12 px rise over 0.5 s; out with a fade over 0.3 s.

**Motion language.** Editorial and unhurried.
- Every ease-out uses the site's `--ease-out` curve; the drawer uses `--ease-drawer`.
- Pieces settle on a spring with low overshoot (damping ≈ 18, mass 0.8).
- Every scene runs a slow push-in. Cross-scene moves are ≤ 24 px offsets with cross-dissolves: no wipes, no whip-pans.

**Square cut (1080×1080).** The same scenes are re-laid out, not cropped:
- browse: a 3-column grid;
- builder: 2 catalogue columns plus the panel;
- drawer: about 60 % of the width;
- product page: a tighter two-column layout;
- phone: larger and centred;
- captions and margins: re-spaced for 1:1.

---

## 3. Build and render plan

```
portfolio-video/
  package.json            remotion 4.0.x, @remotion/cli, @remotion/tailwind-v4, react 19, tailwindcss 4, @fontsource/*
  remotion.config.ts      tailwind, webpack aliases → src/shims, local headless-shell
  src/Root.tsx            compositions GOO-16x9, GOO-1x1 (+ one per scene for previews)
  src/fixtures/           products, look, stylist script, store prices
  src/vendor/             verbatim copies of leaf components (+ VENDORED.md)
  src/shims/              next/link, next/image, framer-motion, contexts
  src/ui/                 page layouts rebuilt from the app's markup, frame-driven
  src/scenes/             Hero, Browse, Builder, Stylist, Product, Phone, EndCard
  src/motion/             curves, springs, Caption, push-in
  public/fixtures/        local product images
  scripts/encode.sh       ffmpeg encode + size check
  out/                    deliverables
```

**Render**
1. Preview: render both formats at half resolution and send you stills of 5 key frames: hero press, browse with chips, builder with the total, stylist with tiles, product with the Best row.
2. Final:
   - Remotion renders a near-lossless master per format.
   - ffmpeg encodes **H.264** (High, yuv420p, `+faststart`) and **VP9** WebM (2-pass, constrained quality).
   - The CRF and bitrate are searched down to the lowest setting that stays under 5 MB. Then the result is checked frame by frame for banding and blocking on the dark gradients and grain.
   - `goo-poster.png` is frame 0.
   - The loop is verified by diffing frame 0 against the last frame.

Deliverables in `out/`: `goo-16x9.mp4`, `goo-16x9.webm`, `goo-1x1.mp4`, `goo-1x1.webm`, `goo-poster.png`.

**Environment** (checked here):
- the npm registry is reachable, `remotion@4.0.535`;
- Chromium headless shell is at `/opt/pw-browsers`;
- system ffmpeg is 6.1.1.

**License.** Remotion is free for individuals and for companies of up to 3 people. Larger companies need a company license.

---

## 4. Decisions (approved by the owner, 2026-10-12)

- **D1 — photos:** about 16 real white-background product shots, copied once from GOO's own storage (the ones the live site shows). Renders run fully offline.
- **D2 — store prices:** the featured item gets 3 store prices in the seed catalogue's format. Goat $148 is real; StockX $162 and Farfetch $185 are illustrative and marked so in `src/fixtures/story.ts`.
- **D3 — cursor:** a subtle pointer, only for presses and picks.
- **D4 — end card:** the hero's big "GOO", so the loop flows into the hero without a jump.
- **D5 — renders:** the final files are committed to a separate `portfolio-video` branch, not to main, with no PR to main.
- **Poster:** not the end card. It is the outfit builder with the board filled and the total shown.
- **Framing rules:**
  - the subject fills ~70–80 % of the frame;
  - it stays readable in a card ~800 px wide;
  - nothing is cropped at the frame edges by accident.

## 5. Changes made while building, and why

Each change serves the framing rules above, the real UI, or both.

- **Scale.** At the app's own size, a desktop page shrinks to 4–6 px type in an 800 px card. Pages therefore play in a rounded "screen" panel at 1.6× (16:9) or 1.25× (1:1). Any cut is the panel's viewport, never the frame's edge.
- **Builder (scene 3) and the poster.**
  - The desktop builder has no board: a catalogue grid sits next to the "In this look" list. Only the phone layout has the board.
  - The scene therefore stages two real builder surfaces side by side: the board (the phone layout's collage canvas, with its "$1,740 · 5 pieces" pill) and the desktop "In this look" column.
  - The pieces drop onto the board; the list fills; "N pieces" and the total count up.
- **Browse (scene 2).** Desktop browse has no row of category chips: filters live in a side panel. The switch therefore uses the page's real active-filter chip (`ActiveChip`): "Outerwear" → "Footwear", and the grid re-deals.
- **AI stylist (scene 4).**
  - The drawer's desktop styles are 12 px bubbles, 72 px tiles and a small "BUILD THIS LOOK" pill.
  - The scene uses the same drawer's phone styles: 15 px bubbles, 84 px tiles and the "Build this look · 2 pieces" row card the storyboard describes. It appears as a sheet over the dimmed browse page.
- **Product page (scene 5).**
  - The page is laid out at 1440 px like the real site; at narrower widths the store rows truncate the store names.
  - The camera then pushes in until "Where to buy" fills ~85 % of the panel.
  - Store logos use the app's own monogram fallback, since the real logos come from the network.
- **Phone (scene 6).** No caption. The look settles onto the phone's board.
