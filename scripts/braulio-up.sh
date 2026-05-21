#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/EquipoBraulio"

docker compose -f "$PROJECT_DIR/docker-compose.yml" --project-directory "$PROJECT_DIR" up --build -d
