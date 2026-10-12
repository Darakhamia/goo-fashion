#!/usr/bin/env bash
# The portrait card's deliverables in out/card/:
#   goo-card.png / goo-card.webp   1200×1600 still (WebP under 300 KB)
#   goo-card-loop.mp4 / .webm      900×1200, 7 s seamless loop, each under 2 MB
# Needs out/stills/card/Card-000.png (node scripts/stills.mjs out/stills/card 1 Card:0)
# and out/master/goo-card-master.mp4 (node scripts/render.mjs card).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/card
LIMIT=${LIMIT:-2000000}
size() { stat -c %s "$1"; }

python3 - <<'PY'
from PIL import Image
import os
src = Image.open("out/stills/card/Card-000.png").convert("RGB")
assert src.size == (1200, 1600), src.size
src.save("out/card/goo-card.png", optimize=True)
for q in (92, 90, 88, 86, 84, 82, 80, 78, 75):
    src.save("out/card/goo-card.webp", "WEBP", quality=q, method=6)
    n = os.path.getsize("out/card/goo-card.webp")
    print(f"webp q={q} {n} bytes")
    if n < 300_000:
        break
PY

src=out/master/goo-card-master.mp4
for crf in ${H264_CRFS:-14 16 18 20 22 24 26}; do
  ffmpeg -y -loglevel error -i "$src" -an -c:v libx264 -preset veryslow -tune animation -crf "$crf" \
    -pix_fmt yuv420p -profile:v high -level 4.1 -movflags +faststart out/card/goo-card-loop.mp4
  s=$(size out/card/goo-card-loop.mp4); echo "h264 card crf=$crf $s bytes"
  [ "$s" -le "$LIMIT" ] && break
done
for crf in ${VP9_CRFS:-24 26 28 30 32 34 36}; do
  common=(-an -c:v libvpx-vp9 -b:v 0 -crf "$crf" -row-mt 1 -tile-columns 1 -pix_fmt yuv420p)
  ffmpeg -y -loglevel error -i "$src" "${common[@]}" -deadline good -cpu-used 4 -pass 1 -passlogfile out/master/vp9-card -f webm /dev/null
  ffmpeg -y -loglevel error -i "$src" "${common[@]}" -deadline good -cpu-used 1 -pass 2 -passlogfile out/master/vp9-card out/card/goo-card-loop.webm
  s=$(size out/card/goo-card-loop.webm); echo "vp9  card crf=$crf $s bytes"
  [ "$s" -le "$LIMIT" ] && break
done
ls -l out/card
