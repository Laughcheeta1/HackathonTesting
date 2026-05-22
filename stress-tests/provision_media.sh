#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIDEO_DIR="$ROOT/k6/videos"
VIDEO_FILE="$VIDEO_DIR/one-minute.mp4"
THUMBNAIL_FILE="$VIDEO_DIR/frame-thumbnail.jpg"

mkdir -p "$VIDEO_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Error: ffmpeg is required to provision k6 media files." >&2
    exit 1
fi

if [[ ! -s "$VIDEO_FILE" ]]; then
    echo "==> Generating k6 one-minute video corpus at $VIDEO_FILE"
    if ! ffmpeg -hide_banner -loglevel error -y \
        -f lavfi -i testsrc2=size=1280x720:rate=30 \
        -f lavfi -i sine=frequency=440:sample_rate=44100 \
        -t 60 \
        -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 2500k \
        -c:a aac -b:a 128k \
        "$VIDEO_FILE"; then
        echo "libx264 generation failed; retrying with mpeg4 encoder."
        ffmpeg -hide_banner -loglevel error -y \
            -f lavfi -i testsrc2=size=1280x720:rate=30 \
            -f lavfi -i sine=frequency=440:sample_rate=44100 \
            -t 60 \
            -c:v mpeg4 -q:v 4 -pix_fmt yuv420p \
            -c:a aac -b:a 128k \
            "$VIDEO_FILE"
    fi
else
    echo "==> k6 one-minute video already exists: $VIDEO_FILE"
fi

if [[ ! -s "$THUMBNAIL_FILE" ]]; then
    echo "==> Generating k6 frame thumbnail at $THUMBNAIL_FILE"
    ffmpeg -hide_banner -loglevel error -y \
        -f lavfi -i testsrc2=size=1100x825:rate=1 \
        -frames:v 1 \
        "$THUMBNAIL_FILE"
else
    echo "==> k6 frame thumbnail already exists: $THUMBNAIL_FILE"
fi
