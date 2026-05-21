#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/EquipoGerman"

wait_for_url() {
    local name="$1"
    local url="$2"
    local timeout_seconds="${3:-300}"
    local started_at
    started_at="$(date +%s)"

    printf 'Waiting for %s at %s\n' "$name" "$url"
    while true; do
        if command -v curl >/dev/null 2>&1; then
            if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
                printf '%s is ready.\n' "$name"
                return 0
            fi
        elif command -v wget >/dev/null 2>&1; then
            if wget -q -T 2 -O /dev/null "$url" >/dev/null 2>&1; then
                printf '%s is ready.\n' "$name"
                return 0
            fi
        else
            echo "Error: curl or wget is required to wait for German startup readiness." >&2
            return 1
        fi

        if (( "$(date +%s)" - started_at >= timeout_seconds )); then
            echo "Error: timed out waiting for ${name} at ${url}" >&2
            docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev ps || true
            docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev logs --tail=80 backend frontend nginx || true
            return 1
        fi

        sleep 2
    done
}

cd "$PROJECT_DIR"
./infra/scripts/deploy.sh --profile dev --target local --hw auto
wait_for_url "German backend" "http://localhost:8000/health"
wait_for_url "German frontend" "http://localhost:5173"
wait_for_url "German nginx API proxy" "http://localhost/api/health"
