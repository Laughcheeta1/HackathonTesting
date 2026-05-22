#!/usr/bin/env bash
set -euo pipefail

name="$1"
url="$2"
timeout_seconds="${3:-300}"
started_at="$(date +%s)"

printf 'Waiting for %s at %s\n' "$name" "$url"
while true; do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
        printf '%s is ready.\n' "$name"
        exit 0
    fi

    if (( "$(date +%s)" - started_at >= timeout_seconds )); then
        printf 'Error: timed out waiting for %s at %s\n' "$name" "$url" >&2
        exit 1
    fi

    sleep 2
done
