# GOO Fashion: portfolio video

A 28.5-second silent promo for GOO Fashion, a vertical cut of it with quiet sound, three 15–16 s vertical shorts, and three vertical feature films. All are made with [Remotion](https://www.remotion.dev/) from captures of the real app.
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

Checked with `ffprobe` (2026-10-13). All four are full resolution, 30 fps, 855 frames (28.5 s), yuv420p. The MP4s carry `moov` before `mdat` (faststart).

| File | Codec | Size | Bitrate |
|---|---|---|---|
| `goo-16x9.mp4` | H.264 High, CRF 18 | 5.84 MB | 1.64 Mb/s |
| `goo-1x1.mp4` | H.264 High, CRF 18 | 4.57 MB | 1.28 Mb/s |
| `goo-16x9.webm` | VP9 two-pass, CRF 30 | 3.19 MB | 0.89 Mb/s |
| `goo-1x1.webm` | VP9 two-pass, CRF 30 | 2.79 MB | 0.78 Mb/s |

### Vertical cut, with sound

The same film at 1080×1920, with quiet sound effects and a soft pad (STORYBOARD.md, "9:16 cut"). The 16:9 and 1:1 loops above stay silent. Checked with `ffprobe` and EBU R128 (2026-10-14):

| File | Video | Audio | Size | Bitrate | Loudness |
|---|---|---|---|---|---|
| `goo-9x16.mp4` | 1080×1920, H.264 High, CRF 18, yuv420p, faststart | AAC-LC 160 kb/s, 48 kHz stereo | 6.39 MB | 1.79 Mb/s (video 1.62) | −24.0 LUFS, true peak −8.1 dBTP |
| `goo-9x16.webm` | 1080×1920, VP9 two-pass, CRF 30 | Opus 128 kb/s, 48 kHz stereo | 3.87 MB | 1.08 Mb/s | −24.0 LUFS, true peak −8.2 dBTP |
| `goo-9x16-poster.png` | 1080×1920, the builder with the whole phone | | | | |

- Both are 30 fps, 855 frames, 28.5 s.
- Frame 0 and the last frame are identical and silent.

### Shorts: Night, Ask, Pocket (MP4 only)

Three 15–16 s vertical films in the same style, each built around one idea, with the same quiet sound (STORYBOARD.md, "Shorts"):
- **Night:** the dark theme.
- **Ask:** the AI stylist fills the builder.
- **Pocket:** the phone site, from results to the stores and the bag.

Checked with `ffprobe` and EBU R128 (2026-10-16):

| File | Length | Video | Size | Bitrate | Loudness |
|---|---|---|---|---|---|
| `goo-night.mp4` | 15.5 s, 465 frames | 1080×1920, H.264 High, CRF 18 | 5.30 MB | 2.74 Mb/s (video 2.57) | −24.0 LUFS, true peak −8.0 dBTP |
| `goo-ask.mp4` | 16.07 s, 482 frames | 1080×1920, H.264 High, CRF 18 | 2.99 MB | 1.49 Mb/s (video 1.32) | −24.0 LUFS, true peak −9.1 dBTP |
| `goo-pocket.mp4` | 15.1 s, 453 frames | 1080×1920, H.264 High, CRF 18 | 3.66 MB | 1.94 Mb/s (video 1.77) | −24.0 LUFS, true peak −8.8 dBTP |

- All three are 30 fps, yuv420p, with AAC-LC audio at 160 kb/s, 48 kHz stereo.
- `moov` comes before `mdat` (faststart).
- Each one's last frame equals its first. Its sound is silent at both ends (below −50 dBFS), so each loops seamlessly.

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
NODE_PATH=/opt/node-tools/node_modules node capture/shoot.cjs       # → public/captures/ (the promo)
NODE_PATH=/opt/node-tools/node_modules node capture/shoot.cjs night ask pocket hero-light   # the shorts
NODE_PATH=/opt/node-tools/node_modules node capture/shoot-features.cjs   # the feature films (morph takes ~10 min per language)
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

# The vertical cut, with sound
python3 scripts/make-sfx.py          # the sound effects and pads → public/audio/ (already committed)
node scripts/render.mjs vertical     # master → out/master/goo-9x16-master.mp4
node scripts/render.mjs audio        # lossless mix → out/master/goo-9x16-audio.wav
scripts/encode-vertical.sh           # -24 LUFS, AAC / Opus → out/goo-9x16.mp4, .webm
node scripts/stills.mjs out 1 GOO-9x16:377 && mv out/GOO-9x16-377.png out/goo-9x16-poster.png

# The shorts (MP4 only)
node scripts/render.mjs shorts       # masters → out/master/goo-{night,ask,pocket}-master.mp4
node scripts/render.mjs shorts-audio # lossless mixes → out/master/goo-{night,ask,pocket}-audio.wav
scripts/encode-shorts.sh             # -24 LUFS, H.264 + AAC → out/goo-{night,ask,pocket}.mp4

# The feature films (MP4 only)
node scripts/render.mjs films        # masters → out/master/goo-{local,colours,search}-master.mp4
node scripts/render.mjs films-audio  # lossless mixes → out/master/goo-{local,colours,search}-audio.wav
scripts/encode-shorts.sh local colours search   # → out/goo-{local,colours,search}.mp4
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
