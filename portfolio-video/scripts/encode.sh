#!/usr/bin/env bash
# Encode the deliverables in out/ from the masters in out/master/
# (node scripts/render.mjs master). Each file must stay under 5 MB: the script
# tries the best quality first and steps the CRF up until the file fits, so
# the result is the best-looking encode that fits.
#   H.264: High profile, yuv420p, -tune animation (flat UI areas), faststart.
#   VP9:   two-pass constrained quality.
set -euo pipefail
cd "$(dirname "$0")/.."
LIMIT=${LIMIT:-5000000}   # bytes ("under 5 MB", decimal, with headroom over MiB)

size() { stat -c %s "$1"; }

for fmt in ${FORMATS:-16x9 1x1}; do
  src="out/master/goo-$fmt-master.mp4"
  [ -f "$src" ] || { echo "missing $src"; exit 1; }

  for crf in ${H264_CRFS:-16 17 18 19 20 21 22 23 24 25 26 27 28}; do
    ffmpeg -y -loglevel error -i "$src" -an \
      -c:v libx264 -preset veryslow -tune animation -crf "$crf" \
      -pix_fmt yuv420p -profile:v high -level 4.1 -movflags +faststart \
      "out/goo-$fmt.mp4"
    s=$(size "out/goo-$fmt.mp4"); echo "h264 $fmt crf=$crf $s bytes"
    [ "$s" -le "$LIMIT" ] && break
  done

  for crf in ${VP9_CRFS:-28 30 32 34 36 38 40 42 44}; do
    common=(-an -c:v libvpx-vp9 -b:v 0 -crf "$crf" -row-mt 1 -tile-columns 2 -pix_fmt yuv420p)
    ffmpeg -y -loglevel error -i "$src" "${common[@]}" -deadline good -cpu-used 4 \
      -pass 1 -passlogfile "out/master/vp9-$fmt" -f webm /dev/null
    ffmpeg -y -loglevel error -i "$src" "${common[@]}" -deadline good -cpu-used 1 \
      -pass 2 -passlogfile "out/master/vp9-$fmt" "out/goo-$fmt.webm"
    s=$(size "out/goo-$fmt.webm"); echo "vp9  $fmt crf=$crf $s bytes"
    [ "$s" -le "$LIMIT" ] && break
  done
done
ls -l out/goo-*.mp4 out/goo-*.webm
