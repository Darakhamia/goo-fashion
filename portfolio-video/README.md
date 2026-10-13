# GOO Fashion: portfolio video

A 28.5-second silent promo for GOO Fashion, made with [Remotion](https://www.remotion.dev/) from captures of the real app.
- **Ad-style:** kinetic type cards alternate with product moments shown big.
- **Self-contained:** it has its own `package.json`, and nothing in the app changed.

| File | What it covers |
|---|---|
| `STORYBOARD.md` | The brief, how the UI is captured, the storyboard and the decisions |
| `VENDORED.md` | What comes from the app: the promo uses captures only. The portrait card still uses two rebuilt pieces. |

## Deliverables (`out/`)

| File | |
|---|---|
| `goo-16x9.mp4` | 1920×1080, 30 fps, H.264 High, yuv420p, CRF 18–20, faststart, ≤ 8 MB |
| `goo-16x9.webm` | 1920×1080, 30 fps, VP9 two-pass |
| `goo-1x1.mp4` | 1080×1080, the same settings. Recomposed for square, not cropped. |
| `goo-1x1.webm` | 1080×1080, VP9 two-pass |
| `goo-poster.png` | 1920×1080: the outfit builder with the board filled and the total shown |

The last frame equals the first (both are the type cards' black), so the loop is seamless:

```html
<video autoplay muted loop playsinline poster="goo-poster.png">
  <source src="goo-16x9.webm" type="video/webm">
  <source src="goo-16x9.mp4" type="video/mp4">
</video>
```

## How it is made

### 1. Capture the real app (`capture/`)

The app runs locally on a stand-in database that serves today's real catalogue. Playwright captures it at deviceScaleFactor 2. Full detail is in STORYBOARD.md §1.

```bash
# The app: a production build of master, in its own worktree (this folder
# would otherwise be swept into the app's type check).
git worktree add --detach ../goo-app origin/master && cd ../goo-app && npm ci
export SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=fixture \
       NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k CLERK_SECRET_KEY=sk_test_fixture
npx next build && npx next start -p 3100 &

# Back here: fixtures, the stand-in database, the captures.
node capture/build-fixtures.mjs
COPY_MISSING=1 node capture/mock-supabase.mjs &            # first run copies the photos once
NODE_PATH=/opt/node-tools/node_modules node capture/shoot.cjs       # → public/captures/
NODE_PATH=/opt/node-tools/node_modules node capture/compare.cjs /tmp/compare   # live vs local
```

| Part | Where |
|---|---|
| Fixture sources (exported from goo-fashion.com's public API) | `capture/fixtures/source/` |
| Database tables | `capture/fixtures/db/` |
| Illustrative data, marked (D2) | `capture/fixtures/illustrative.json` |

The photo cache (`capture/fixtures/storage/`) is not committed. The captures made from it are.

### 2. Render (`src/promo/`)

```bash
npm ci
npm run studio                       # preview in the browser
node scripts/stills.mjs out/stills 1 GOO-16x9:50,187,377,584,752,835   # key-beat stills
node scripts/render.mjs master       # full-resolution near-lossless masters → out/master/
scripts/encode.sh                    # deliverables → out/
node scripts/stills.mjs out 1 GOO-16x9:377 && mv out/GOO-16x9-377.png out/goo-poster.png
```

- Renders run offline from the committed captures.
- The font, Inter Tight, is bundled.
- The browser is the Chromium headless shell at `/opt/pw-browsers`; override it with `REMOTION_BROWSER`.

## Portrait card (`out/card/`)

A 3:4 card for the portfolio's filmstrip carousel, made 2026-10-12, before the capture pipeline. It shows the builder with its board filled, recomposed from the builder's phone layout on the site's background `#0A0A0A`. No caption, no logo.

| File | |
|---|---|
| `goo-card.png` | 1200×1600 still |
| `goo-card.webp` | 1200×1600 still, under 300 KB |
| `goo-card-loop.mp4` | 900×1200, 7 s seamless loop, H.264, under 2 MB |
| `goo-card-loop.webm` | 900×1200, 7 s seamless loop, VP9, under 2 MB |

```bash
node scripts/stills.mjs out/stills/card 1 Card:0   # the still, 1200×1600
node scripts/render.mjs card                       # loop master, 900×1200
scripts/encode-card.sh                             # → out/card/
```

## Data

- **Catalogue:** every product is a real item from GOO's live catalogue as of 2026-10-13.
- **Stores:** the featured sneaker's second and third stores (StockX, Farfetch) are illustrative, marked in `capture/fixtures/illustrative.json`. The live catalogue lists it at one store.
- **Stylist:** the exchange is scripted; no model is called.

Remotion is free for individuals and for companies of up to three people. Larger companies need a company license.
