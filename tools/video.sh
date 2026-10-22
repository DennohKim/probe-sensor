#!/bin/sh
# Records, scores, contact-sheets and jump-checks one figure: tools/video.sh 01-reading-the-meter
set -e
cd "$(dirname "$0")/.."
name="$1"
mkdir -p video
node tools/record.mjs "figures/$name/index.html" --out "video/$name.mp4"
node tools/score.mjs "video/$name.mp4" "video/$name-scored.mp4"
ffmpeg -loglevel error -y -i "video/$name.mp4" -vf "fps=1/3,scale=500:-1,tile=4x3:padding=6:color=0xf5f0e5" -frames:v 1 "video/$name-sheet.png"
node tools/jumps.mjs "video/$name.mp4" > "video/$name.jumps.txt"
mv "video/$name-scored.mp4" "video/$name.mp4"
