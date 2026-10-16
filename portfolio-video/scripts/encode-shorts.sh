#!/usr/bin/env bash
# Encode the three shorts (9:16, with sound) as MP4, from their full-resolution
# masters and lossless sound mixes:
#   node scripts/render.mjs shorts         → out/master/goo-<name>-master.mp4
#   node scripts/render.mjs shorts-audio   → out/master/goo-<name>-audio.wav
#   scripts/encode-shorts.sh [night ask pocket]   → out/goo-<name>.mp4
#
# MP4 only: H.264 High, yuv420p, CRF 18–20, faststart, AAC-LC 160 kb/s 48 kHz
# stereo. The sound is kept quiet, as in the vertical cut: each mix is brought
# to TARGET_LUFS integrated (default -24 LUFS) with its true peak at or under
# MAX_TP (-6 dBTP). Each file must stay within LIMIT bytes.
set -euo pipefail
cd "$(dirname "$0")/.."
LIMIT=${LIMIT:-8000000}
TARGET_LUFS=${TARGET_LUFS:--24}
MAX_TP=${MAX_TP:--6}

measure() { # integrated loudness (LUFS) and true peak (dBTP) of a file's audio
  ffmpeg -hide_banner -nostats -i "$1" -map a:0 -af ebur128=peak=true -f null - 2>&1 \
    | awk '/Integrated loudness:/{f=1} f&&/I:/{i=$2} /True peak:/{g=1} g&&/Peak:/{p=$2} END{print i, p}'
}

names=("$@")
[ ${#names[@]} -gt 0 ] || names=(night ask pocket)
for n in "${names[@]}"; do
  video=out/master/goo-$n-master.mp4
  mix=out/master/goo-$n-audio.wav
  out=out/goo-$n.mp4
  [ -f "$video" ] || { echo "missing $video"; exit 1; }
  [ -f "$mix" ] || { echo "missing $mix"; exit 1; }

  read -r I0 P0 < <(measure "$mix")
  gain=$(awk -v t="$TARGET_LUFS" -v i="$I0" 'BEGIN{printf "%.2f", t - i}')
  echo "$n mix: $I0 LUFS, true peak $P0 dBTP → gain ${gain} dB to $TARGET_LUFS LUFS"
  awk -v p="$P0" -v g="$gain" -v m="$MAX_TP" 'BEGIN{ if (p + g > m) { printf "true peak would be %.1f dBTP, over %s\n", p + g, m; exit 1 } }'

  for crf in ${H264_CRFS:-18 19 20}; do
    ffmpeg -y -loglevel error -i "$video" -i "$mix" -map 0:v:0 -map 1:a:0 -r 30 \
      -c:v libx264 -preset veryslow -crf "$crf" -pix_fmt yuv420p -profile:v high -level 4.1 \
      -af "volume=${gain}dB" -c:a aac -b:a 160k -ar 48000 -ac 2 \
      -movflags +faststart -shortest "$out"
    s=$(stat -c %s "$out"); echo "$n crf=$crf $s bytes"
    [ "$s" -le "$LIMIT" ] && break
    [ "$crf" = 20 ] && { echo "$out is over the cap at CRF 20"; exit 1; }
  done
  read -r I P < <(measure "$out")
  echo "$out: $I LUFS, true peak $P dBTP"
done
ls -l out/goo-night.mp4 out/goo-ask.mp4 out/goo-pocket.mp4 2>/dev/null || true
