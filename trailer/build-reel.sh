#!/usr/bin/env bash
# Build the 30-second Reels cut from the 58-second master.
#
# The video is a per-segment speed remap of the long trailer, matching the
# segment table in cut30.js exactly. The audio is NOT the long score sped up
# — it is the separate 30s arrangement, rendered offline from score.js.
#
# Usage: build-reel.sh <master.mp4> <reel-score.wav> <out.mp4>
set -e

SRC="$1"
WAV="$2"
OUT="$3"
FF="${FFMPEG:-ffmpeg}"

# dst_start dst_end src_start src_end   (BLACK for a held black frame)
SEGMENTS=(
  "0.00  3.40   0.80   6.95"
  "3.40  3.55   BLACK  BLACK"
  "3.55  6.30  12.20  15.00"
  "6.30 11.00  19.30  24.00"
  "11.00 14.30 24.30  30.60"
  "14.30 18.00 32.20  40.00"
  "18.00 18.35 40.00  40.34"
  "18.35 25.60 40.34  50.00"
  "25.60 26.10 BLACK  BLACK"
  "26.10 30.00 52.60  58.00"
)

# A build dir beside the output, with RELATIVE paths in the concat list:
# a Windows-native ffmpeg run from Git Bash misreads /tmp/... as C:/tmp/...
TMP=".reel-build"
rm -rf "$TMP"; mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT
LIST="$TMP/list.txt"
: > "$LIST"

i=0
for seg in "${SEGMENTS[@]}"; do
  read -r d0 d1 s0 s1 <<< "$seg"
  dur=$(awk "BEGIN{printf \"%.4f\", $d1-$d0}")
  part="$TMP/p$i.mp4"

  if [ "$s0" = "BLACK" ]; then
    "$FF" -v error -y -f lavfi -i "color=c=black:s=1080x1920:r=60:d=$dur" \
      -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p "$part"
  else
    srcdur=$(awk "BEGIN{printf \"%.4f\", $s1-$s0}")
    # setpts divides by the rate: >1 speeds the segment up
    rate=$(awk "BEGIN{printf \"%.6f\", $srcdur/$dur}")
    "$FF" -v error -y -ss "$s0" -to "$s1" -i "$SRC" \
      -filter:v "setpts=PTS/$rate,fps=60" -an \
      -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p "$part"
  fi

  echo "file 'p$i.mp4'" >> "$LIST"
  i=$((i+1))
done

# Join the segments, attach the 30s score, and master the loudness to the
# streaming standard so the platforms do not turn it down or distort it.
"$FF" -v error -y -f concat -safe 0 -i "$LIST" -i "$WAV" \
  -map 0:v:0 -map 1:a:0 -shortest \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -level 4.2 -r 60 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"

echo "built $OUT"
