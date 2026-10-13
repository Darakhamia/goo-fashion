#!/usr/bin/env bash
# Encode the deliverables in out/ from the full-resolution masters in
# out/master/ (node scripts/render.mjs master). Never from a preview.
#   H.264: High profile, yuv420p, CRF 18–20, faststart, up to 8 MB. The script
#          starts at CRF 18 and steps up only if the file would exceed the cap.
#   VP9:   two-pass constrained quality, same cap.
set -euo pipefail
cd "$(dirname "$0")/.."
LIMIT=${LIMIT:-8000000}   # bytes ("up to 8 MB", decimal)

size() { stat -c %s "$1"; }

for fmt in ${FORMATS:-16x9 1x1}; do
  src="out/master/goo-$fmt-master.mp4"
  [ -f "$src" ] || { echo "missing $src"; exit 1; }

  for crf in ${H264_CRFS:-18 19 20}; do
    ffmpeg -y -loglevel error -i "$src" -an -r 30 \
      -c:v libx264 -preset veryslow -crf "$crf" \
      -pix_fmt yuv420p -profile:v high -level 4.1 -movflags +faststart \
      "out/goo-$fmt.mp4"
    s=$(size "out/goo-$fmt.mp4"); echo "h264 $fmt crf=$crf $s bytes"
    [ "$s" -le "$LIMIT" ] && break
    [ "$crf" = 20 ] && { echo "goo-$fmt.mp4 is over the cap at CRF 20"; exit 1; }
  done

  for crf in ${VP9_CRFS:-30 32 34 36 38 40}; do
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
