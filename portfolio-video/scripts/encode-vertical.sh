#!/usr/bin/env bash
# Encode the vertical cut (9:16, with sound) from its full-resolution master
# and its lossless sound mix:
#   node scripts/render.mjs vertical   → out/master/goo-9x16-master.mp4
#   node scripts/render.mjs audio      → out/master/goo-9x16-audio.wav
#
# Sound is kept quiet on purpose: the mix is brought to TARGET_LUFS integrated
# loudness (default -24 LUFS, about 10 dB below what social platforms aim for),
# and its true peak is checked to stay at or under -6 dBTP.
#   MP4:  H.264 High, yuv420p, CRF 18–20, faststart, AAC-LC 160 kb/s 48 kHz stereo.
#   WebM: VP9 two-pass constrained quality, Opus 128 kb/s.
# Each file must stay within LIMIT bytes.
set -euo pipefail
cd "$(dirname "$0")/.."
LIMIT=${LIMIT:-8000000}
TARGET_LUFS=${TARGET_LUFS:--24}
MAX_TP=${MAX_TP:--6}

video=out/master/goo-9x16-master.mp4
mix=out/master/goo-9x16-audio.wav
[ -f "$video" ] || { echo "missing $video"; exit 1; }
[ -f "$mix" ] || { echo "missing $mix"; exit 1; }

size() { stat -c %s "$1"; }
measure() { # integrated loudness (LUFS) and true peak (dBTP) of a file's audio
  ffmpeg -hide_banner -nostats -i "$1" -map a:0 -af ebur128=peak=true -f null - 2>&1 \
    | awk '/Integrated loudness:/{f=1} f&&/I:/{i=$2} /True peak:/{g=1} g&&/Peak:/{p=$2} END{print i, p}'
}

read -r I0 P0 < <(measure "$mix")
gain=$(awk -v t="$TARGET_LUFS" -v i="$I0" 'BEGIN{printf "%.2f", t - i}')
echo "mix: $I0 LUFS, true peak $P0 dBTP → gain ${gain} dB to $TARGET_LUFS LUFS"
awk -v p="$P0" -v g="$gain" -v m="$MAX_TP" 'BEGIN{ if (p + g > m) { printf "true peak would be %.1f dBTP, over %s\n", p + g, m; exit 1 } }'

for crf in ${H264_CRFS:-18 19 20}; do
  ffmpeg -y -loglevel error -i "$video" -i "$mix" -map 0:v:0 -map 1:a:0 -r 30 \
    -c:v libx264 -preset veryslow -crf "$crf" -pix_fmt yuv420p -profile:v high -level 4.1 \
    -af "volume=${gain}dB" -c:a aac -b:a 160k -ar 48000 -ac 2 \
    -movflags +faststart -shortest out/goo-9x16.mp4
  s=$(size out/goo-9x16.mp4); echo "h264 9x16 crf=$crf $s bytes"
  [ "$s" -le "$LIMIT" ] && break
  [ "$crf" = 20 ] && { echo "goo-9x16.mp4 is over the cap at CRF 20"; exit 1; }
done

for crf in ${VP9_CRFS:-30 32 34 36 38 40}; do
  common=(-c:v libvpx-vp9 -b:v 0 -crf "$crf" -row-mt 1 -tile-columns 2 -pix_fmt yuv420p)
  ffmpeg -y -loglevel error -i "$video" -map 0:v:0 -an "${common[@]}" -deadline good -cpu-used 4 \
    -pass 1 -passlogfile out/master/vp9-9x16 -f webm /dev/null
  ffmpeg -y -loglevel error -i "$video" -i "$mix" -map 0:v:0 -map 1:a:0 "${common[@]}" -deadline good -cpu-used 1 \
    -pass 2 -passlogfile out/master/vp9-9x16 \
    -af "volume=${gain}dB" -c:a libopus -b:a 128k -ar 48000 -ac 2 -shortest out/goo-9x16.webm
  s=$(size out/goo-9x16.webm); echo "vp9  9x16 crf=$crf $s bytes"
  [ "$s" -le "$LIMIT" ] && break
done

for f in out/goo-9x16.mp4 out/goo-9x16.webm; do
  read -r I P < <(measure "$f")
  echo "$f: $I LUFS, true peak $P dBTP"
done
ls -l out/goo-9x16.*
