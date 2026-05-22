#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT/stress-tests/common/ensure-docker.sh"
"$ROOT/scripts/cristobal-up.sh"
"$ROOT/stress-tests/common/wait-for-url.sh" "Cristobal frontend" "http://localhost:5173" 300
"$ROOT/stress-tests/common/wait-for-url.sh" "Cristobal backend" "http://localhost:8000/health" 300
